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

import json
from typing import Any

from marshmallow import fields, Schema, validate


class ColumnViewSchemeStateSchema(Schema):
    state_version = fields.Integer(required=True, validate=validate.Equal(1))
    viz_type = fields.String(
        required=True,
        validate=validate.Equal("ag-grid-table-scheme"),
    )
    state_type = fields.String(required=True, validate=validate.Equal("column_view"))
    column_signature = fields.String(required=False, allow_none=True)
    columns = fields.List(fields.Dict(), required=True)
    raw_column_state = fields.List(fields.Dict(), required=True)
    meta = fields.Dict(required=False)


class ColumnViewSchemePostSchema(Schema):
    chart_id = fields.Integer(required=True)
    dashboard_id = fields.Integer(required=False, allow_none=True)
    dataset_id = fields.Integer(required=False, allow_none=True)
    name = fields.String(required=True, validate=validate.Length(min=1, max=128))
    description = fields.String(
        required=False,
        allow_none=True,
        validate=validate.Length(max=512),
    )
    is_default = fields.Boolean(load_default=False)
    state = fields.Nested(ColumnViewSchemeStateSchema, required=True)


class ColumnViewSchemePutSchema(Schema):
    name = fields.String(required=False, validate=validate.Length(min=1, max=128))
    description = fields.String(
        required=False,
        allow_none=True,
        validate=validate.Length(max=512),
    )
    is_default = fields.Boolean(required=False)
    state = fields.Nested(ColumnViewSchemeStateSchema, required=False)


class ColumnViewSchemeResponseSchema(Schema):
    id = fields.Integer()
    uuid = fields.String()
    chart_id = fields.Integer()
    dashboard_id = fields.Integer(allow_none=True)
    dataset_id = fields.Integer(allow_none=True)
    user_id = fields.Integer()
    name = fields.String()
    description = fields.String(allow_none=True)
    is_default = fields.Boolean()
    is_deleted = fields.Boolean()
    state_version = fields.Integer()
    column_signature = fields.String(allow_none=True)
    created_on = fields.DateTime(allow_none=True)
    changed_on = fields.DateTime(allow_none=True)
    state = fields.Method("get_state")

    def get_state(self, obj: Any) -> dict[str, Any]:
        return json.loads(obj.state_json)
