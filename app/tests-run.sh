#!/bin/bash
#
# Unit Tests runner script
# For now it simply loads Mocha test runner with default parameters through meteor.
# By default it runs in continuous mode (waiting for files to change); use "--once" flag to do a
# single test pass.
# To run a single test use "--grep <testname>".
# Tests listen on port 3100 by default so they don't collide with a dev server on 3000;
# use "--port <port>" to change it.
#
#

echo "## Unit Tests Runner script"

usage() {
  echo "##   Usage: $0 [--once] [--grep <test-name>] [--port <port>]"
  exit 1
}

NPM_COMMAND="run test:watch"

while test $# -gt 0; do
  case "$1" in
    --once)
      NPM_COMMAND="test"
      ;;
    --grep)
      shift
      export MOCHA_GREP=$1
      ;;
    --port)
      shift
      export TEST_PORT=$1
      ;;
    --help)
      usage
      ;;
    *)
      echo "Unknown argument $1"
      usage
      ;;
  esac
  shift
done

npm $NPM_COMMAND $@

