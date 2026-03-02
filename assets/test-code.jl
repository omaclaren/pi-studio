# Julia test file for pi-studio language highlighting
module TestModule

using LinearAlgebra
import Base: show

struct Point{T<:Real}
    x::T
    y::T
end

const ORIGIN = Point(0.0, 0.0)

function distance(a::Point, b::Point)
    dx = a.x - b.x
    dy = a.y - b.y
    return sqrt(dx^2 + dy^2)
end

function solve_system(A, b)
    # Direct solve
    x = A \ b
    residual = norm(A * x - b)
    if residual > 1e-10
        @warn "Large residual: $residual"
    end
    return x
end

mutable struct Counter
    value::Int
end

for i in 1:10
    println("Step $i: $(i^2)")
end

export Point, distance, solve_system

end # module
