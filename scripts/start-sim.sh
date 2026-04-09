#!/bin/bash
docker rm -f oro-sim 2>/dev/null || true
docker run --detach --privileged --network=host \
  -v /home/clari/inorbit:/home/docker/dev \
  -v /sys/fs/cgroup:/sys/fs/cgroup \
  --cgroupns=host \
  --name oro-sim \
  inorbit:noetic-desktop-full-focal-systemd
sleep 2
docker exec -it oro-sim /bin/bash
