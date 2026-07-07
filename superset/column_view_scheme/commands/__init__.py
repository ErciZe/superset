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

from superset.column_view_scheme.commands.exceptions import (
    ColumnViewSchemeForbiddenError,
)
from superset.column_view_scheme.models import ColumnViewScheme
from superset.utils import json


def ensure_owner(scheme: ColumnViewScheme, user_id: int) -> None:
    if scheme.user_id != user_id:
        raise ColumnViewSchemeForbiddenError()


def encode_state(state: dict[str, Any]) -> str:
    return json.dumps(state, sort_keys=True)


def apply_state(scheme: ColumnViewScheme, state: dict[str, Any]) -> None:
    scheme.state_json = encode_state(state)
    scheme.state_version = state["state_version"]
    scheme.column_signature = state.get("column_signature")
