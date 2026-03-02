# Model calibration pipeline

Inverse problem workflow for geothermal reservoir calibration: observed data constrains model parameters through iterative forward solves.

```mermaid
flowchart TD
    A[Field observations] --> B[Misfit function]
    C[Prior parameter distribution] --> D[Parameter sampler]
    D --> E[Forward model solve]
    E --> F[Simulated observables]
    F --> B
    B --> G{Converged?}
    G -- No --> H[Update parameters]
    H --> D
    G -- Yes --> I[Posterior ensemble]
    I --> J[Prediction with uncertainty]

    style A fill:#1a1a2e,stroke:#5ea1ff,color:#e6edf3
    style I fill:#1a1a2e,stroke:#73d13d,color:#e6edf3
    style J fill:#1a1a2e,stroke:#73d13d,color:#e6edf3
```

## Data types

| Observable | Measurement | Uncertainty |
|---|---|---|
| Downhole temperature | PT logs at steady state | ±2°C sensor + borehole effects |
| Production enthalpy | Separator measurements | ±20 kJ/kg (two-phase sampling) |
| Surface heat flux | Shallow gradient holes | ±15% (ground conditions) |
| Pressure drawdown | Wellhead transducers | ±0.5 bar |

The forward model maps permeability, porosity, and boundary conditions to these observables. The inverse problem is ill-posed — regularisation via prior information prevents overfitting to noisy data.
