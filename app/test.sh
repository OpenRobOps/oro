#!/bin/bash
SCRIPT="test"
if [ "$1" == "--watch" ] || [ "$1" == "-w" ]; then
	SCRIPT="test:watch"
fi
npm run $SCRIPT
