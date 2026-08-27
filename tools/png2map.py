#!/usr/bin/env python3
#
# Copyright 2026 InOrbit, Inc.
#
#    Licensed under the Apache License, Version 2.0 (the "License");
#    you may not use this file except in compliance with the License.
#    You may obtain a copy of the License at
#
#      http://www.apache.org/licenses/LICENSE-2.0
#
#    Unless required by applicable law or agreed to in writing, software
#    distributed under the License is distributed on an "AS IS" BASIS,
#    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#    See the License for the specific language governing permissions and
#    limitations under the License.
"""Turn a PNG into a SpatialAnnotation ConfigAPI YAML document.

    png2map.py map.png --id warehouse --frame map --resolution 0.05 --x 0 --y 0 [--label ...]
               [--scope system|<robotId>] [--format-version 1|2] [--from-ros-yaml map.yaml]

--from-ros-yaml lifts `resolution` and `origin[0..1]` from a ROS map_server yaml (values given
explicitly on the command line win). Output goes to stdout; pipe into a file or straight into
`curl -X POST .../api/configuration/apply`.
"""
import argparse, base64, json, re, sys

def ros_yaml(path):
    # Tiny parser for the flat ROS map yaml (top-level `key: value` pairs only, no
    # nesting/multiline); avoids a PyYAML dependency.
    out = {}
    for line in open(path):
        line = line.split("#", 1)[0]
        m = re.match(r"^(\w+):\s*(.+?)\s*$", line)
        if m:
            k, v = m.groups()
            out[k] = json.loads(v) if v.startswith("[") else v
    return out

p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
p.add_argument("png")
p.add_argument("--id", required=True, help="map id (metadata.id / label)")
p.add_argument("--frame", default="map", help="frameId the image is drawn in")
p.add_argument("--label", help="display name (default: --id)")
p.add_argument("--scope", default="system", help="'system' or a robot id")
p.add_argument("--resolution", type=float, help="metres per pixel")
p.add_argument("--x", type=float, help="world x of the bottom-left corner")
p.add_argument("--y", type=float, help="world y of the bottom-left corner")
p.add_argument("--format-version", type=int, choices=[1, 2], default=2)
p.add_argument("--from-ros-yaml")
a = p.parse_args()

if a.from_ros_yaml:
    r = ros_yaml(a.from_ros_yaml)
    a.resolution = a.resolution if a.resolution is not None else float(r["resolution"])
    a.x = a.x if a.x is not None else float(r["origin"][0])
    a.y = a.y if a.y is not None else float(r["origin"][1])
for k in ("resolution", "x", "y"):
    if getattr(a, k) is None:
        sys.exit(f"--{k} is required (or --from-ros-yaml)")

data = open(a.png, "rb").read()
if data[:8] != b"\x89PNG\r\n\x1a\n":
    sys.exit(f"{a.png}: not a PNG")
b64 = base64.b64encode(data).decode()

print(f"""kind: SpatialAnnotation
apiVersion: v0.1
metadata:
  id: {json.dumps(a.id)}
spec:
  scope: {json.dumps(a.scope)}
  type: map
  frameId: {json.dumps(a.frame)}
  label: {json.dumps(a.label or a.id)}
  x: {a.x}
  y: {a.y}
  resolution: {a.resolution}
  formatVersion: {a.format_version}
  image: {b64}""")
