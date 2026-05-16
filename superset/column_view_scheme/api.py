# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
from __future__ import annotations

from typing import Any

from flask import g, request, Response
from flask_appbuilder.api import expose, protect, safe
from marshmallow import ValidationError

from superset import is_feature_enabled, security_manager
from superset.commands.chart.exceptions import ChartNotFoundError
from superset.commands.exceptions import CommandException
from superset.column_view_scheme.commands.create import CreateColumnViewSchemeCommand
from superset.column_view_scheme.commands.delete import DeleteColumnViewSchemeCommand
from superset.column_view_scheme.commands.set_default import (
    SetDefaultColumnViewSchemeCommand,
)
from superset.column_view_scheme.commands.update import UpdateColumnViewSchemeCommand
from superset.column_view_scheme.dao import ColumnViewSchemeDAO
from superset.column_view_scheme.schemas import (
    ColumnViewSchemePostSchema,
    ColumnViewSchemePutSchema,
    ColumnViewSchemeResponseSchema,
)
from superset.constants import MODEL_API_RW_METHOD_PERMISSION_MAP
from superset.daos.chart import ChartDAO
from superset.extensions import event_logger
from superset.views.base_api import BaseSupersetApi, requires_json, statsd_metrics


class ColumnViewSchemeRestApi(BaseSupersetApi):
    resource_name = "column_view_scheme"
    allow_browser_login = True
    class_permission_name = "ColumnViewSchemeRestApi"
    method_permission_name = {
        **MODEL_API_RW_METHOD_PERMISSION_MAP,
        "get_default": "read",
        "set_default": "write",
    }
    openapi_spec_tag = "Column View Scheme"
    openapi_spec_component_schemas = (
        ColumnViewSchemePostSchema,
        ColumnViewSchemePutSchema,
    )

    add_model_schema = ColumnViewSchemePostSchema()
    edit_model_schema = ColumnViewSchemePutSchema()
    response_schema = ColumnViewSchemeResponseSchema()
    response_many_schema = ColumnViewSchemeResponseSchema(many=True)

    def _feature_enabled_response(self) -> Response | None:
        if not is_feature_enabled("COLUMN_VIEW_SCHEME_ENABLED"):
            return self.response_404()
        return None

    def _current_user_id(self) -> int | None:
        user = getattr(g, "user", None)
        if user is None or getattr(user, "is_anonymous", False):
            return None
        return getattr(user, "id", None)

    def _parse_required_chart_id(self) -> int | None:
        return request.args.get("chart_id", type=int)

    def _parse_dashboard_id(self) -> int | None:
        return request.args.get("dashboard_id", type=int)

    def _ensure_chart_access(self, chart_id: int) -> Response | None:
        try:
            chart = ChartDAO.get_by_id_or_uuid(str(chart_id))
        except ChartNotFoundError:
            return self.response_404()
        if not security_manager.can_access_chart(chart):
            return self.response_403()
        return None

    def _permission_context(self, chart_id: int | None) -> tuple[int, Response | None]:
        user_id = self._current_user_id()
        if user_id is None:
            return 0, self.response_403()
        if chart_id is None:
            return user_id, self.response(422, message={"chart_id": ["Missing data."]})
        access_response = self._ensure_chart_access(chart_id)
        if access_response is not None:
            return user_id, access_response
        return user_id, None

    def _get_user_scheme(
        self,
        scheme_id: int,
    ) -> tuple[Any | None, int, Response | None]:
        user_id = self._current_user_id()
        if user_id is None:
            return None, 0, self.response_403()
        scheme = ColumnViewSchemeDAO.find_by_id_for_user(scheme_id, user_id)
        if not scheme:
            return None, user_id, self.response_404()
        return scheme, user_id, None

    def _command_exception_response(self, ex: CommandException) -> Response:
        return self.response(ex.status, message=str(ex))

    @expose("/", methods=("GET",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this
    def get_list(self) -> Response:
        response = self._feature_enabled_response()
        if response is not None:
            return response
        chart_id = self._parse_required_chart_id()
        user_id, response = self._permission_context(chart_id)
        if response is not None:
            return response
        assert chart_id is not None
        schemes = ColumnViewSchemeDAO.find_all_for_user(
            chart_id,
            self._parse_dashboard_id(),
            user_id,
        )
        return self.response(200, result=self.response_many_schema.dump(schemes))

    @expose("/default", methods=("GET",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this
    def get_default(self) -> Response:
        response = self._feature_enabled_response()
        if response is not None:
            return response
        chart_id = self._parse_required_chart_id()
        user_id, response = self._permission_context(chart_id)
        if response is not None:
            return response
        assert chart_id is not None
        scheme = ColumnViewSchemeDAO.find_default(
            chart_id,
            self._parse_dashboard_id(),
            user_id,
        )
        result: dict[str, Any] | None = (
            self.response_schema.dump(scheme) if scheme else None
        )
        return self.response(200, result=result)

    @expose("/", methods=("POST",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this
    @requires_json
    def post(self) -> Response:
        response = self._feature_enabled_response()
        if response is not None:
            return response
        try:
            item = self.add_model_schema.load(request.json)
        except ValidationError as ex:
            return self.response(422, message=ex.messages)
        user_id, response = self._permission_context(item["chart_id"])
        if response is not None:
            return response
        try:
            scheme = CreateColumnViewSchemeCommand(item, user_id).run()
            return self.response(201, result=self.response_schema.dump(scheme))
        except CommandException as ex:
            return self._command_exception_response(ex)

    @expose("/<int:scheme_id>", methods=("PUT",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this
    @requires_json
    def put(self, scheme_id: int) -> Response:
        response = self._feature_enabled_response()
        if response is not None:
            return response
        try:
            item = self.edit_model_schema.load(request.json)
        except ValidationError as ex:
            return self.response(422, message=ex.messages)

        existing, user_id, response = self._get_user_scheme(scheme_id)
        if response is not None:
            return response
        assert existing is not None
        response = self._ensure_chart_access(existing.chart_id)
        if response is not None:
            return response
        try:
            scheme = UpdateColumnViewSchemeCommand(scheme_id, item, user_id).run()
            return self.response(200, result=self.response_schema.dump(scheme))
        except CommandException as ex:
            return self._command_exception_response(ex)

    @expose("/<int:scheme_id>", methods=("DELETE",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this
    def delete(self, scheme_id: int) -> Response:
        response = self._feature_enabled_response()
        if response is not None:
            return response
        existing, user_id, response = self._get_user_scheme(scheme_id)
        if response is not None:
            return response
        assert existing is not None
        response = self._ensure_chart_access(existing.chart_id)
        if response is not None:
            return response
        try:
            DeleteColumnViewSchemeCommand(scheme_id, user_id).run()
            return self.response(200, message="OK")
        except CommandException as ex:
            return self._command_exception_response(ex)

    @expose("/<int:scheme_id>/set_default", methods=("POST",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this
    def set_default(self, scheme_id: int) -> Response:
        response = self._feature_enabled_response()
        if response is not None:
            return response
        existing, user_id, response = self._get_user_scheme(scheme_id)
        if response is not None:
            return response
        assert existing is not None
        response = self._ensure_chart_access(existing.chart_id)
        if response is not None:
            return response
        try:
            scheme = SetDefaultColumnViewSchemeCommand(scheme_id, user_id).run()
            return self.response(200, result=self.response_schema.dump(scheme))
        except CommandException as ex:
            return self._command_exception_response(ex)
