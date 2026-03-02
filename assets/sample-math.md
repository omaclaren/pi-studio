# Reaction-diffusion pattern formation

Consider a two-species activator-inhibitor system on a 2D domain $\Omega$:

$$\frac{\partial u}{\partial t} = D_u \nabla^2 u + f(u, v), \qquad \frac{\partial v}{\partial t} = D_v \nabla^2 v + g(u, v)$$

where $u$ is the activator, $v$ the inhibitor, and $D_v \gg D_u$ (long-range inhibition, short-range activation).

## Turing instability condition

Linearising around the homogeneous steady state $(u_0, v_0)$ and substituting a perturbation $\propto e^{i\mathbf{k}\cdot\mathbf{x}}$ with wavenumber $k = |\mathbf{k}|$, the dispersion relation is:

$$\sigma(k^2) = \frac{1}{2}\left[\text{tr}(J_k) \pm \sqrt{\text{tr}(J_k)^2 - 4\det(J_k)}\right]$$

where the $k$-dependent Jacobian is:

$$J_k = \begin{pmatrix} f_u - D_u k^2 & f_v \\ g_u & g_v - D_v k^2 \end{pmatrix}$$

Instability requires $\det(J_k) < 0$ for some band of wavenumbers, giving the **critical ratio**:

$$\frac{D_v}{D_u} > \frac{(f_u g_v - f_v g_u)^2}{f_u^2 g_v^2}$$

## Schnakenberg kinetics

A standard choice is $f(u,v) = a - u + u^2 v$ and $g(u,v) = b - u^2 v$, with steady state:

$$u_0 = a + b, \qquad v_0 = \frac{b}{(a+b)^2}$$

The most unstable wavenumber $k^*$ selects the spatial scale of the emergent pattern — spots, stripes, or labyrinths depending on domain geometry and nonlinear saturation.
