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

from sqlalchemy.orm.query import Query

from superset.column_view_scheme.models import ColumnViewScheme
from superset.extensions import db


class ColumnViewSchemeDAO:
    @staticmethod
    def _active_query() -> Query:
        return db.session.query(ColumnViewScheme).filter(
            ColumnViewScheme.is_deleted.is_(False)
        )

    @staticmethod
    def _filter_scope(query: Query, chart_id: int, dashboard_id: int | None) -> Query:
        query = query.filter(ColumnViewScheme.chart_id == chart_id)
        if dashboard_id is None:
            return query.filter(ColumnViewScheme.dashboard_id.is_(None))
        return query.filter(ColumnViewScheme.dashboard_id == dashboard_id)

    @classmethod
    def find_by_id(cls, scheme_id: int) -> ColumnViewScheme | None:
        return (
            cls._active_query().filter(ColumnViewScheme.id == scheme_id).one_or_none()
        )

    @classmethod
    def find_by_id_for_user(
        cls,
        scheme_id: int,
        user_id: int,
    ) -> ColumnViewScheme | None:
        return (
            cls._active_query()
            .filter(
                ColumnViewScheme.id == scheme_id,
                ColumnViewScheme.user_id == user_id,
            )
            .one_or_none()
        )

    @classmethod
    def find_all_for_user(
        cls,
        chart_id: int,
        dashboard_id: int | None,
        user_id: int,
    ) -> list[ColumnViewScheme]:
        return (
            cls._filter_scope(cls._active_query(), chart_id, dashboard_id)
            .filter(ColumnViewScheme.user_id == user_id)
            .order_by(
                ColumnViewScheme.is_default.desc(),
                ColumnViewScheme.changed_on.desc(),
            )
            .all()
        )

    @classmethod
    def find_default(
        cls,
        chart_id: int,
        dashboard_id: int | None,
        user_id: int,
    ) -> ColumnViewScheme | None:
        base_query = cls._active_query().filter(
            ColumnViewScheme.chart_id == chart_id,
            ColumnViewScheme.user_id == user_id,
            ColumnViewScheme.is_default.is_(True),
        )
        if dashboard_id is not None:
            dashboard_default = (
                base_query.filter(ColumnViewScheme.dashboard_id == dashboard_id)
                .order_by(ColumnViewScheme.changed_on.desc())
                .first()
            )
            if dashboard_default:
                return dashboard_default

        return (
            base_query.filter(ColumnViewScheme.dashboard_id.is_(None))
            .order_by(ColumnViewScheme.changed_on.desc())
            .first()
        )

    @classmethod
    def clear_default(
        cls,
        chart_id: int,
        dashboard_id: int | None,
        user_id: int,
    ) -> None:
        schemes = (
            cls._filter_scope(cls._active_query(), chart_id, dashboard_id)
            .filter(
                ColumnViewScheme.user_id == user_id,
                ColumnViewScheme.is_default.is_(True),
            )
            .all()
        )
        for scheme in schemes:
            scheme.is_default = False

    @classmethod
    def find_duplicate_name(
        cls,
        chart_id: int,
        user_id: int,
        name: str,
        exclude_id: int | None = None,
    ) -> ColumnViewScheme | None:
        query = cls._active_query().filter(
            ColumnViewScheme.chart_id == chart_id,
            ColumnViewScheme.user_id == user_id,
            ColumnViewScheme.name == name,
        )
        if exclude_id is not None:
            query = query.filter(ColumnViewScheme.id != exclude_id)
        return query.one_or_none()
