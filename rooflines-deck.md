## T_math (compute time) = computation FLOPs divided by ___
accelerator FLOPs/s; FLOPs per second; peak FLOPs/s

## T_comms (communication time) = communication bytes divided by ___
bandwidth; network bandwidth; bytes/s

## Lower bound on runtime when compute and comms overlap perfectly
max(T_math, T_comms); the max; max

## Upper bound on runtime with no overlap
T_math + T_comms; the sum; sum

## When T_math is the larger term you are ___ bound
compute

## When T_comms is the larger term you are ___ bound
communication; memory

## Arithmetic intensity = computation FLOPs divided by ___
communication bytes; bytes moved; bytes

## Arithmetic intensity crossover between compute and memory bound is about
240

## Above the arithmetic-intensity crossover the chip is ___ bound
compute

## Below the arithmetic-intensity crossover the chip is ___ bound
memory

## A bf16 dot product's arithmetic intensity asymptotes to
1/2; 0.5

## FLOPs to multiply X[B,D] by Y[D,F]
2BDF

## Bytes moved for the bf16 matmul X[B,D] times Y[D,F]
2BD+2DF+2BF; 2(BD+DF+BF)

## When batch B is small versus D and F, matmul intensity is about
B

## The weight matrix gives high intensity because it is loaded once and ___ across the batch
reused

## In a 2-chip split matmul, T_comms = 2BF divided by ___
network bandwidth; bandwidth
