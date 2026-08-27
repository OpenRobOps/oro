# Bootstrap Configuration

This folder contains YAML files to use as initial configuration when starting from a blank database.

Config files must be named `{kind}.yaml` and contain only objects of that same kind. 
They are imported upon server startup, only if no configurations exist for that kind. 

So this effectively initializes a good initial database when starting from a blank deployment.
In development environments, one can just drop a config collection to get all objects recreated
to defaults using this method.

See `server/bootstrapConfig.js`.

`SpatialAnnotation.yaml` — the rendered flatland sample map, shared by all robots (generated with `tools/png2map.py`).