# Derived Attributes service

All files here correspond to the Derived Attributes service. 
This one is currently bundled in the `ingest` service, for simplicity in the most basic deployments,
but it could be deployed separately.

It processes attribute updates and computes "derived" attributes defined with expressions computed
over other attributes and built-in functions from our expressions language.

It receives updates from message queues, so it is decoupled from the rest of the codebase and it
is able to run independently from ingest, through AMQP queues.

