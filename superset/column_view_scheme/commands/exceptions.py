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

from flask_babel import lazy_gettext as _

from superset.commands.exceptions import (
    CommandException,
    CommandInvalidError,
    CreateFailedError,
    DeleteFailedError,
    UpdateFailedError,
)


class ColumnViewSchemeError(CommandException):
    message = _("Column view scheme error.")


class ColumnViewSchemeForbiddenError(ColumnViewSchemeError):
    status = 403
    message = _("You do not have permission to access this column view scheme.")


class ColumnViewSchemeNotFoundError(ColumnViewSchemeError):
    status = 404
    message = _("Column view scheme not found.")


class ColumnViewSchemeInvalidError(CommandInvalidError):
    status = 422
    message = _("Column view scheme parameters are invalid.")

    def __init__(self, message: str | None = None) -> None:
        super().__init__(message or str(self.message))


class ColumnViewSchemeCreateFailedError(CreateFailedError):
    message = _("Column view scheme could not be created.")


class ColumnViewSchemeUpdateFailedError(UpdateFailedError):
    message = _("Column view scheme could not be updated.")


class ColumnViewSchemeDeleteFailedError(DeleteFailedError):
    message = _("Column view scheme could not be deleted.")


class ColumnViewSchemeSetDefaultFailedError(UpdateFailedError):
    message = _("Column view scheme default could not be updated.")
