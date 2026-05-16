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

from functools import partial
from typing import Any

from superset.column_view_scheme.commands import apply_state, ensure_owner
from superset.column_view_scheme.commands.exceptions import (
    ColumnViewSchemeInvalidError,
    ColumnViewSchemeNotFoundError,
    ColumnViewSchemeUpdateFailedError,
)
from superset.column_view_scheme.dao import ColumnViewSchemeDAO
from superset.column_view_scheme.models import ColumnViewScheme
from superset.commands.base import BaseCommand
from superset.utils.decorators import on_error, transaction


class UpdateColumnViewSchemeCommand(BaseCommand):
    def __init__(self, scheme_id: int, data: dict[str, Any], user_id: int):
        self._scheme_id = scheme_id
        self._properties = data.copy()
        self._user_id = user_id
        self._scheme: ColumnViewScheme | None = None

    @transaction(on_error=partial(on_error, reraise=ColumnViewSchemeUpdateFailedError))
    def run(self) -> ColumnViewScheme:
        self.validate()
        scheme = self._scheme
        assert scheme is not None

        for key in ("name", "description", "is_default"):
            if key in self._properties:
                setattr(scheme, key, self._properties[key])
        if "state" in self._properties:
            apply_state(scheme, self._properties["state"])
        if self._properties.get("is_default") is True:
            ColumnViewSchemeDAO.clear_default(
                scheme.chart_id,
                scheme.dashboard_id,
                self._user_id,
            )
            scheme.is_default = True
        return scheme

    def validate(self) -> None:
        scheme = ColumnViewSchemeDAO.find_by_id(self._scheme_id)
        if not scheme:
            raise ColumnViewSchemeNotFoundError()
        ensure_owner(scheme, self._user_id)

        next_name = self._properties.get("name", scheme.name)
        if next_name != scheme.name:
            duplicate = ColumnViewSchemeDAO.find_duplicate_name(
                scheme.chart_id,
                self._user_id,
                next_name,
                exclude_id=scheme.id,
            )
            if duplicate:
                raise ColumnViewSchemeInvalidError(
                    "A column view scheme with this name already exists."
                )
        self._scheme = scheme
