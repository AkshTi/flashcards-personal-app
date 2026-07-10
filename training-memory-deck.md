# Training memory & efficiency deck — the memory math every frontier-lab interview probes. Import into FlashDesk; each ## question plus the short answer line below becomes one card. Covers bytes-per-param accounting, ZeRO stage formulas, activation memory, checkpointing, and precision formats.

## Bytes per parameter for weights in fp32
4

## Bytes per parameter for weights in bf16 or fp16
2

## Bytes per parameter for Adam optimizer state in fp32 (both moments)
8

## Mixed-precision Adam training total bytes per parameter (weights, grads, master weights, moments)
16

## Break down the 16 bytes per parameter of mixed-precision Adam training
2 weight, 2 grad, 4 master weight, 4 momentum, 4 variance

## Model states for a 7B model at 16 bytes per param
112 GB; about 112 GB

## Why keep an fp32 master copy of weights in mixed precision?
small updates underflow in 16-bit; lr times grad is too small to change a 16-bit weight

## ZeRO stage 1 shards which state across data-parallel ranks?
optimizer state; optimizer states

## ZeRO stage 2 shards optimizer state plus ___
gradients

## ZeRO stage 3 shards optimizer state, gradients, and ___
parameters; weights

## Per-device model-state bytes per param under ZeRO-3 with N ranks
16 over N; 16/N

## Per-device bytes per param under ZeRO-1 with large N
4; about 4, weights and grads stay replicated

## ZeRO-2 per-device bytes per param with large N
2; about 2, only bf16 weights stay replicated

## PyTorch's native implementation of ZeRO-3 is called
FSDP; fully sharded data parallel

## In FSDP's forward pass, each unit's parameters are materialized with which collective?
AllGather

## In FSDP's backward pass, gradients are sharded with which collective?
ReduceScatter

## FSDP total comm volume vs plain DDP
1.5x; 3x params vs 2x params, i.e. 1.5 times DDP

## Activation memory scales with batch times seq times hidden times ___
layers; number of layers; depth

## Activation checkpointing stores only ___ activations and recomputes the rest
boundary; layer-boundary; checkpointed

## Activation checkpointing costs roughly one extra ___ pass of compute
forward; forward pass, about 33 percent more FLOPs

## With checkpointing every layer, activation memory drops from O(L) to O(___) per layer stored
1; sqrt(L) with optimal placement; constant per layer

## Gradient accumulation simulates a large batch by summing grads over k steps before ___
the optimizer step; stepping; updating

## Gradient accumulation reduces which memory: activations or optimizer state?
activations; activation memory per microbatch

## bf16 has how many exponent bits?
8

## fp16 has how many exponent bits?
5

## bf16 has how many mantissa bits?
7

## Why is bf16 preferred over fp16 for LLM training?
same exponent range as fp32, so no overflow and no loss scaling needed

## fp16 training requires ___ scaling to keep small gradients from underflowing
loss

## How does dynamic loss scaling react to an overflow (inf or NaN) in the grads?
skip the step and halve the scale

## The two fp8 formats and their typical roles
e4m3 for forward activations and weights, e5m2 for gradients

## Which GPU generation first shipped fp8 tensor cores?
Hopper; H100

## Largest consumer of memory at long sequence lengths during training
activations; activation memory

## CPU offload of optimizer state trades memory for ___ traffic
PCIe; host-device transfer; PCIe bandwidth

## Empty-looking OOM after many steps despite constant batch usually means memory ___
fragmentation

## PyTorch env var that mitigates allocator fragmentation
PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True

## Total training FLOPs approximation for a model with N params on D tokens
6ND; 6 N D

## Rule of thumb: checkpointing plus recompute raises step FLOPs from 6ND toward ___
8ND; about 8ND

## MFU is achieved throughput divided by ___
peak hardware FLOPs; theoretical peak FLOPs per second

## A good training MFU for large transformer runs is roughly
40 to 50 percent; 40-50%; about half
