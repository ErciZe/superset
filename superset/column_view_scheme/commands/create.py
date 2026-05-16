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

from superset.column_view_scheme.commands import apply_state
from superset.column_view_scheme.commands.exceptions import (
    ColumnViewSchemeCreateFailedError,
    ColumnViewSchemeInvalidError,
)
from superset.column_view_scheme.dao import ColumnViewSchemeDAO
from superset.column_view_scheme.models import ColumnViewScheme
from superset.commands.base import BaseCommand
from superset.extensions import db
from superset.utils.decorators import on_error, transaction


class CreateColumnViewSchemeCommand(BaseCommand):
    def __init__(self, data: dict[str, Any], user_id: int):
        self._properties = data.copy()
        self._user_id = user_id

    @transaction(on_error=partial(on_error, reraise=ColumnViewSchemeCreateFailedError))
    def run(self) -> ColumnViewScheme:
        self.validate()
        state = self._properties["state"]
        scheme = ColumnViewScheme(
            chart_id=self._properties["chart_id"],
            dashboard_id=self._properties.get("dashboard_id"),
            dataset_id=self._properties.get("dataset_id"),
            user_id=self._user_id,
            name=self._properties["name"],
            description=self._properties.get("description"),
            is_default=self._properties.get("is_default", False),
        )
        apply_state(scheme, state)
        if scheme.is_default:
            ColumnViewSchemeDAO.clear_default(
                scheme.chart_id,
                scheme.dashboard_id,
                self._user_id,
            )
        db.session.add(scheme)
        return scheme

    def validate(self) -> None:
        duplicate = ColumnViewSchemeDAO.find_duplicate_name(
            self._properties["chart_id"],
            self._user_id,
            self._properties["name"],
        )
        if duplicate:
            raise ColumnViewSchemeInvalidError(
                "A column view scheme with this name already exists."
            )
