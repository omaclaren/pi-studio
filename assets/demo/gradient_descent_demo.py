#!/usr/bin/env python3
"""Generate figures for the pi Studio README demo.

Run from the repository root:

    python3 assets/demo/gradient_descent_demo.py
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
import matplotlib.pyplot as plt


OUTPUT_DIR = Path(__file__).resolve().parent / "generated"


def f(x: np.ndarray | float, y: np.ndarray | float) -> np.ndarray | float:
    return 0.35 * x**2 + 1.2 * y**2 + 0.8 * np.sin(1.5 * x) * np.cos(2.0 * y)


def grad(x: float, y: float) -> np.ndarray:
    dfdx = 0.7 * x + 1.2 * np.cos(1.5 * x) * np.cos(2.0 * y)
    dfdy = 2.4 * y - 1.6 * np.sin(1.5 * x) * np.sin(2.0 * y)
    return np.array([dfdx, dfdy])


def run_gradient_descent(start: tuple[float, float] = (-3.4, 2.8), eta: float = 0.14, steps: int = 30) -> np.ndarray:
    path = [np.array(start, dtype=float)]
    p = path[0].copy()
    for _ in range(steps):
        p = p - eta * grad(float(p[0]), float(p[1]))
        path.append(p.copy())
    return np.vstack(path)


def save_contour_plot(path: np.ndarray) -> None:
    xs = np.linspace(-4.5, 4.5, 260)
    ys = np.linspace(-3.4, 3.4, 220)
    X, Y = np.meshgrid(xs, ys)
    Z = f(X, Y)

    fig, ax = plt.subplots(figsize=(6.2, 4.6), dpi=160)
    levels = np.linspace(float(Z.min()), float(Z.max()), 34)
    contour = ax.contourf(X, Y, Z, levels=levels, cmap="viridis")
    ax.contour(X, Y, Z, levels=levels[::2], colors="white", linewidths=0.35, alpha=0.45)
    ax.plot(path[:, 0], path[:, 1], color="#ff6b6b", linewidth=2.0, marker="o", markersize=2.2)
    ax.scatter(path[0, 0], path[0, 1], s=36, color="#ffd166", edgecolor="black", linewidth=0.5, label="start", zorder=5)
    ax.scatter(path[-1, 0], path[-1, 1], s=36, color="#06d6a0", edgecolor="black", linewidth=0.5, label="final", zorder=5)
    ax.set_title("Gradient descent on a non-convex surface", fontsize=10)
    ax.set_xlabel("x")
    ax.set_ylabel("y")
    ax.legend(loc="upper right", frameon=True, fontsize=7)
    fig.colorbar(contour, ax=ax, label="f(x, y)")
    fig.tight_layout()
    fig.savefig(OUTPUT_DIR / "gradient_descent_contour.png", bbox_inches="tight")
    plt.close(fig)


def save_convergence_plot(path: np.ndarray) -> None:
    values = np.array([f(float(x), float(y)) for x, y in path])
    iterations = np.arange(len(values))

    fig, ax = plt.subplots(figsize=(5.8, 3.4), dpi=160)
    ax.plot(iterations, values, color="#2a9d8f", linewidth=2.2, marker="o", markersize=3)
    ax.set_title("Objective value by iteration", fontsize=10)
    ax.set_xlabel("iteration")
    ax.set_ylabel("f(x_k, y_k)")
    ax.grid(True, color="#d0d7de", linewidth=0.7, alpha=0.8)
    ax.margins(x=0.02)
    fig.tight_layout()
    fig.savefig(OUTPUT_DIR / "gradient_descent_convergence.png", bbox_inches="tight")
    plt.close(fig)


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    path = run_gradient_descent()
    save_contour_plot(path)
    save_convergence_plot(path)
    print(f"Wrote {OUTPUT_DIR / 'gradient_descent_contour.png'}")
    print(f"Wrote {OUTPUT_DIR / 'gradient_descent_convergence.png'}")


if __name__ == "__main__":
    main()
