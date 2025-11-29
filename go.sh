#!/usr/bin/env bash
set -euo pipefail

command=$1

function help {
    echo "Usage: ./go.sh <command> [arguments]"
    echo "Commands:"
    echo "- local: Run the application locally using Docker Compose."
}

function localz {
    docker build server -t i18u-server:latest
    docker build client -t i18u-client:latest --build-arg VITE_API_URL=http://api.imaaronnicetomeetyou.me
    docker compose up
}

case $command in
    local)
        localz
        ;;
    *)
        help
        ;;
esac