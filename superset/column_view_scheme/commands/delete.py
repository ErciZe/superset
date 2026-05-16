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

from superset.column_view_scheme.commands import ensure_owner
from superset.column_view_scheme.commands.exceptions import (
    ColumnViewSchemeDeleteFailedError,
    ColumnViewSchemeNotFoundError,
)
from superset.column_view_scheme.dao import ColumnViewSchemeDAO
from superset.column_view_scheme.models import ColumnViewScheme
from superset.commands.base import BaseCommand
from superset.utils.decorators import on_error, transaction


MAX_SCHEME_NAME_LENGTH = 128
DELETED_NAME_SEPARATOR = "__deleted__"


def tombstone_name(name: str, scheme_id: int) -> str:
    suffix = f"{DELETED_NAME_SEPARATOR}{scheme_id}"
    prefix_length = MAX_SCHEME_NAME_LENGTH - len(suffix)
    assert prefix_length > 0
    return f"{name[:prefix_length]}{suffix}"


class DeleteColumnViewSchemeCommand(BaseCommand):
    def __init__(self, scheme_id: int, user_id: int):
        self._scheme_id = scheme_id
        self._user_id = user_id
        self._scheme: ColumnViewScheme | None = None

    @transaction(on_error=partial(on_error, reraise=ColumnViewSchemeDeleteFailedError))
    def run(self) -> None:
        self.validate()
        scheme = self._scheme
        assert scheme is not None
        assert scheme.id is not None
        scheme.name = tombstone_name(scheme.name, scheme.id)
        scheme.is_default = False
        scheme.is_deleted = True

    def validate(self) -> None:
        scheme = ColumnViewSchemeDAO.find_by_id(self._scheme_id)
        if not scheme:
            raise ColumnViewSchemeNotFoundError()
        ensure_owner(scheme, self._user_id)
        self._scheme = scheme
