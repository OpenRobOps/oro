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
"""Fit the rigid transform that lays one map image onto another, as a SpatialTransformation.

    align_maps.py --src robot_map.png --src-meta RES,X,Y[,FORMATVERSION] \
                  --dst floor_plan.png --dst-meta RES,X,Y[,FORMATVERSION] \
                  [--from map] [--to location] [--src-wall-max 50] [--dst-wall-max 80] \
                  [--init DEG,TX,TY] [--overlay overlay.png] > transform.yaml

Wall pixels (gray <= --*-wall-max, alpha > 128) of both images are converted to metres using
each image's metadata, a coarse rotation/translation search is followed by point-to-point ICP,
and the result is printed as a `SpatialTransformation` YAML document (stdout). Fit quality and
reference points go to stderr; `--overlay` writes the source walls in red over the destination
image so you can eyeball the result.

FORMATVERSION follows ORO's SpatialAnnotation: 1 (default) = row 0 of the image is world y = Y
(rows stored top-down), 2 = row 0 is the top, world y grows upward (ROS map_server PGM/PNG).
Getting this wrong per image is the usual cause of a mirrored, unfittable result.

Requires numpy, scipy, Pillow.  `align_maps.py --selftest` checks the fitter on synthetic data.
"""
import argparse
import sys

import numpy as np
from PIL import Image
from scipy import ndimage, spatial

MAX_SRC_POINTS = 6000  # ponytail: uniform subsample keeps coarse search under ~30 s


def parse_meta(s):
    v = [float(x) for x in s.split(",")]
    if len(v) not in (3, 4):
        sys.exit(f"--*-meta must be RES,X,Y[,FORMATVERSION], got {s!r}")
    res, x0, y0 = v[:3]
    fv = int(v[3]) if len(v) == 4 else 1
    if fv not in (1, 2):
        sys.exit("FORMATVERSION must be 1 or 2")
    return res, x0, y0, fv


def wall_points(png, meta, wall_max):
    """Dark, opaque pixels -> Nx2 array of world (x, y) in metres, per formatVersion."""
    res, x0, y0, fv = meta
    la = np.array(Image.open(png).convert("LA"))
    gray, alpha = la[..., 0], la[..., 1]
    height = gray.shape[0]
    rows, cols = np.nonzero((alpha > 128) & (gray <= wall_max))
    if len(rows) == 0:
        sys.exit(f"{png}: no wall pixels with gray <= {wall_max}; raise the threshold")
    x = x0 + (cols + 0.5) * res
    y = y0 + ((rows + 0.5) if fv == 1 else (height - rows - 0.5)) * res
    return np.stack([x, y], axis=1), height


def world_to_pixel(pts, meta, height):
    res, x0, y0, fv = meta
    cols = ((pts[:, 0] - x0) / res).astype(int)
    r = (pts[:, 1] - y0) / res
    rows = (r if fv == 1 else height - r).astype(int)
    return rows, cols


def rot(theta):
    c, s = np.cos(theta), np.sin(theta)
    return np.array([[c, -s], [s, c]])


def coarse_search(P, Q, step_deg=0.5, span_m=4.0, step_m=0.5, cell=0.1):
    """Max-overlap search over all rotations and a translation grid around centroid alignment."""
    qmin = Q.min(0) - span_m - 1
    shape = np.ceil((Q.max(0) + span_m + 1 - qmin) / cell).astype(int)[::-1]
    grid = np.zeros(shape, bool)
    idx = ((Q - qmin) / cell).astype(int)
    grid[idx[:, 1], idx[:, 0]] = True
    grid = ndimage.binary_dilation(grid, iterations=3)
    offsets = np.arange(-span_m, span_m + 1e-9, step_m)
    best = (-1, 0.0, np.zeros(2))
    for deg in np.arange(-180, 180, step_deg):
        Pr = P @ rot(np.radians(deg)).T
        t0 = Q.mean(0) - Pr.mean(0)
        for dx in offsets:
            for dy in offsets:
                t = t0 + [dx, dy]
                ij = ((Pr + t - qmin) / cell).astype(int)
                ok = (ij[:, 0] >= 0) & (ij[:, 0] < shape[1]) & (ij[:, 1] >= 0) & (ij[:, 1] < shape[0])
                score = grid[ij[ok, 1], ij[ok, 0]].sum()
                if score > best[0]:
                    best = (score, deg, t.copy())
    return np.radians(best[1]), best[2]


def icp(P, Q, theta, t, max_pair_dist=0.5, iters=40):
    """Point-to-point ICP with a 2D Kabsch step; returns (theta, t, nearest-neighbour dists)."""
    tree = spatial.cKDTree(Q)
    for _ in range(iters):
        Pt = P @ rot(theta).T + t
        d, j = tree.query(Pt, distance_upper_bound=max_pair_dist)
        m = np.isfinite(d)
        if m.sum() < 3:
            break
        A, B = P[m], Q[j[m]]
        ca, cb = A.mean(0), B.mean(0)
        U, _, Vt = np.linalg.svd((A - ca).T @ (B - cb))
        R = Vt.T @ U.T
        if np.linalg.det(R) < 0:  # reflection guard
            Vt[1] *= -1
            R = Vt.T @ U.T
        theta_new, t_new = np.arctan2(R[1, 0], R[0, 0]), cb - ca @ R.T
        converged = abs(theta_new - theta) < 1e-9 and np.allclose(t_new, t, atol=1e-8)
        theta, t = theta_new, t_new
        if converged:
            break
    d, _ = tree.query(P @ rot(theta).T + t)
    return theta, t, d


def fit(P, Q, init=None):
    if len(P) > MAX_SRC_POINTS:
        P = P[np.random.default_rng(0).choice(len(P), MAX_SRC_POINTS, replace=False)]
    theta, t = init if init else coarse_search(P, Q)
    return icp(P, Q, theta, t)


def yaml_doc(theta, t, frm, to):
    c, s = np.cos(theta), np.sin(theta)
    rows = [[c, -s, t[0]], [s, c, t[1]], [0, 0, 1]]
    fmt = lambda r: "[" + ", ".join(f"{v:.6f}".rstrip("0").rstrip(".") if v else "0" for v in r) + "]"
    return "\n".join([
        f"# {frm} -> {to}: rotation {np.degrees(theta):+.3f} deg, translation ({t[0]:.4f}, {t[1]:.4f})",
        "apiVersion: v0.1",
        "kind: SpatialTransformation",
        "metadata:",
        "  id: system",
        "spec:",
        "  transformations:",
        f"  - from: {frm}",
        f"    to: {to}",
        "    matrix:",
        *[f"    - {fmt(r)}" for r in rows],
    ])


def selftest():
    # Synthetic room: rectangle outline + an inner wall, 5 cm sampling.
    xs = np.arange(0, 20, 0.05)
    ys = np.arange(0, 12, 0.05)
    Q = np.concatenate([
        np.stack([xs, np.zeros_like(xs)], 1), np.stack([xs, np.full_like(xs, 12)], 1),
        np.stack([np.zeros_like(ys), ys], 1), np.stack([np.full_like(ys, 20), ys], 1),
        np.stack([np.full_like(ys[:120], 8), ys[:120]], 1),
    ])
    theta_true, t_true = np.radians(37.0), np.array([5.3, -2.1])
    # P is Q expressed in the "robot" frame: Q = R P + t  =>  P = R^T (Q - t)
    P = (Q - t_true) @ rot(theta_true) + np.random.default_rng(1).normal(0, 0.01, Q.shape)
    theta, t, d = fit(P, Q)
    assert abs(np.degrees(theta - theta_true)) < 0.2, np.degrees(theta)
    assert np.allclose(t, t_true, atol=0.05), t
    assert (d < 0.1).mean() > 0.95
    print("selftest ok:", f"{np.degrees(theta):.3f} deg", np.round(t, 3))


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--src", help="image drawn in the --from frame (usually the robot's SLAM grid)")
    p.add_argument("--src-meta", help="RES,X,Y[,FORMATVERSION] of --src")
    p.add_argument("--dst", help="image drawn in the --to frame (usually the pretty floor plan)")
    p.add_argument("--dst-meta", help="RES,X,Y[,FORMATVERSION] of --dst")
    p.add_argument("--from", dest="frm", default="map")
    p.add_argument("--to", default="location")
    p.add_argument("--src-wall-max", type=int, default=50, help="gray <= this is a wall (default 50)")
    p.add_argument("--dst-wall-max", type=int, default=80, help="gray <= this is a wall (default 80)")
    p.add_argument("--init", help="DEG,TX,TY starting guess; skips the coarse search")
    p.add_argument("--overlay", help="write src walls (red) over dst image to this PNG")
    p.add_argument("--selftest", action="store_true")
    a = p.parse_args()
    if a.selftest:
        return selftest()
    for k in ("src", "src_meta", "dst", "dst_meta"):
        if getattr(a, k) is None:
            sys.exit(f"--{k.replace('_', '-')} is required")

    src_meta, dst_meta = parse_meta(a.src_meta), parse_meta(a.dst_meta)
    P, _ = wall_points(a.src, src_meta, a.src_wall_max)
    Q, dst_h = wall_points(a.dst, dst_meta, a.dst_wall_max)
    err = sys.stderr
    print(f"src walls: {len(P)} pts, x {P[:,0].min():.1f}..{P[:,0].max():.1f} y {P[:,1].min():.1f}..{P[:,1].max():.1f}", file=err)
    print(f"dst walls: {len(Q)} pts, x {Q[:,0].min():.1f}..{Q[:,0].max():.1f} y {Q[:,1].min():.1f}..{Q[:,1].max():.1f}", file=err)

    init = None
    if a.init:
        deg, tx, ty = (float(v) for v in a.init.split(","))
        init = (np.radians(deg), np.array([tx, ty]))
    theta, t, d = fit(P, Q, init)

    print("inliers (src wall points within N m of a dst wall):", file=err)
    for tol in (0.1, 0.2, 0.3):
        print(f"  {tol:.1f} m: {(d < tol).mean():5.1%}", file=err)
    print("reference points (%s -> %s), paste-able as referencePoints:" % (a.frm, a.to), file=err)
    for sp in ((0.0, 0.0), (10.0, 0.0), (0.0, 10.0)):
        dp = rot(theta) @ sp + t
        print(f"  - {{ from: {{x: {sp[0]}, y: {sp[1]}}}, to: {{x: {dp[0]:.4f}, y: {dp[1]:.4f}}} }}", file=err)

    if a.overlay:
        dst = Image.open(a.dst).convert("RGBA")
        img = np.array(Image.alpha_composite(Image.new("RGBA", dst.size, "white"), dst).convert("RGB"))
        rows, cols = world_to_pixel(P @ rot(theta).T + t, dst_meta, dst_h)
        ok = (rows >= 0) & (rows < img.shape[0]) & (cols >= 0) & (cols < img.shape[1])
        for dr in (-1, 0, 1):
            for dc in (-1, 0, 1):
                img[np.clip(rows[ok] + dr, 0, img.shape[0] - 1), np.clip(cols[ok] + dc, 0, img.shape[1] - 1)] = (255, 0, 0)
        Image.fromarray(img).save(a.overlay)
        print(f"overlay written to {a.overlay}", file=err)

    print(yaml_doc(theta, t, a.frm, a.to))


if __name__ == "__main__":
    main()
