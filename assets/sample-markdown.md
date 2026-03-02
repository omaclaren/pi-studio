# Weekly research notes — compartmental models

## Progress

Refactored the reaction kinetics DSL to separate **stoichiometry** from **kinetics**. The same species/reaction specification now drives both deterministic ODE integration and stochastic Gillespie simulation:

```julia
model = @reaction_network begin
    k1, S + E --> SE        # substrate binding
    k2, SE --> S + E        # unbinding
    k3, SE --> P + E        # catalysis
end
```

Key insight: the stoichiometry matrix $N$ and propensity vector $a(x)$ are independent concerns. The ODE system is just $\dot{x} = N \cdot a(x)$, while Gillespie uses the same $N$ and $a(x)$ to sample jump times.

## Open questions

- How to handle **non-Markovian delays** (e.g. cell division timers) without breaking the reaction interface?
- Should fractional/distributed delays live in the kinetics layer or require a separate extension?

> "The art of modelling is knowing what to leave out." — Richard Hamming (paraphrased)

## Next steps

1. Benchmark against [Catalyst.jl](https://github.com/SciML/Catalyst.jl) on the Oregonator
2. Add `@delay_reaction` macro for fixed-delay channels
3. Write up the stoichiometry/kinetics separation as a short note

---

*Last updated 2026-03-02*
