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

import argparse
import json
from pathlib import Path
from typing import Any

from scripts.hot_product_index_dashboard import (
    COLOR_DISPLAY_MAPPINGS,
    COLOR_MAP_SNAPSHOT_PATH,
)


def validate_rows(rows: list[dict[str, Any]]) -> None:
    """Fail when active production rows differ from the release snapshot."""
    actual = sorted(
        (
            str(row["color_code"]),
            str(row["color_name_zh"]),
            str(row["display_hex"]),
        )
        for row in rows
        if int(row["is_active"]) == 1
    )
    expected = sorted(
        (
            str(row["color_code"]),
            str(row["color_name_zh"]),
            str(row["display_hex"]),
        )
        for row in COLOR_DISPLAY_MAPPINGS
    )
    if actual != expected:
        raise ValueError("production color map differs from release snapshot")


def main() -> int:
    """Validate exported production rows against the versioned snapshot."""
    parser = argparse.ArgumentParser()
    parser.add_argument("rows_json", type=Path)
    args = parser.parse_args()
    rows = json.loads(args.rows_json.read_text(encoding="utf-8"))
    if not isinstance(rows, list):
        raise ValueError("rows JSON must contain a list")
    validate_rows(rows)
    print(
        json.dumps(
            {
                "snapshot": str(COLOR_MAP_SNAPSHOT_PATH),
                "active_mapping_count": len(COLOR_DISPLAY_MAPPINGS),
                "check_pass": True,
            },
            ensure_ascii=False,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
