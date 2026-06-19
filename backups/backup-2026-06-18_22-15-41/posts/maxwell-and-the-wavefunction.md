---
title: "Maxwell, the Wavefunction, and a Little Python"
date: 2026-02-11
category: ["math", "physics"]
tags: ["electromagnetism", "quantum", "latex"]
layoutType: "math"
---

two beautiful equations, and a script to ground one of them.

## The quantum state

A particle's state is encoded in a complex wavefunction $\psi(x,t)$, and the
probability density of finding it at position $x$ is $|\psi(x,t)|^2$. Its time
evolution obeys the Schrödinger equation,

$$
i\hbar \frac{\partial \psi}{\partial t} = -\frac{\hbar^2}{2m}\frac{\partial^2 \psi}{\partial x^2} + V(x)\,\psi.
$$

Normalization demands $\int_{-\infty}^{\infty} |\psi(x,t)|^2\,dx = 1$, so the
particle is *somewhere* with certainty.

## Maxwell's fourth equation

The Ampère–Maxwell law ties magnetic circulation to current and to a changing
electric field — the displacement-current term $\mu_0 \epsilon_0 \,\partial_t \mathbf{E}$
that Maxwell added to make the set consistent:

$$
\nabla \times \mathbf{B} = \mu_0 \mathbf{J} + \mu_0 \epsilon_0 \frac{\partial \mathbf{E}}{\partial t}.
$$

In vacuum ($\mathbf{J} = 0$) this couples to Faraday's law and gives a wave
equation with speed $c = 1/\sqrt{\mu_0 \epsilon_0}$. Light is an electromagnetic
wave; that factor is *why*.

## Making it concrete

A quick numerical check that $c = 1/\sqrt{\mu_0 \epsilon_0}$ really lands on the
speed of light:

```python
import math

mu_0 = 4 * math.pi * 1e-7        # vacuum permeability  [T·m/A]
eps_0 = 8.8541878128e-12         # vacuum permittivity  [F/m]

c = 1.0 / math.sqrt(mu_0 * eps_0)
print(f"c = {c:.0f} m/s")        # -> c = 299792458 m/s
```

The same constants that govern a fridge magnet and a capacitor fix the speed of
light to the meter-per-second. The inline form $E = mc^2$ then ties that speed to
mass and energy — but that's a note for another day.
