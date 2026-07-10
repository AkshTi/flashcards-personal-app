# GPU hardware deck — the NVIDIA counterpart to tpu-hardware-deck.md. Import into FlashDesk; each ## question plus the short answer line below becomes one card. Key H100/A100 numbers, the memory hierarchy, and the roofline crossovers you should know cold in an interview.

## The GPU's basic compute building block, analogous to a CPU core cluster
SM; streaming multiprocessor

## How many SMs does an H100 SXM have?
132

## How many SMs does an A100 have?
108

## Which unit inside an SM does the matrix multiplies?
tensor core; tensor cores

## Threads execute in lockstep groups of 32 called
warps; a warp

## When threads in a warp take different branches, execution serializes; this is called warp ___
divergence

## H100 SXM peak dense bf16 throughput
989 TFLOPs; about 1000 TFLOPs; 1 PFLOP

## A100 peak dense bf16 throughput
312 TFLOPs

## H100 fp8 dense peak is ___ times its bf16 peak
2; two; double, about 1979 TFLOPs

## H100 HBM capacity and bandwidth
80 GB at 3.35 TB/s

## A100 80GB HBM bandwidth
2 TB/s; about 2 TB/s

## On-chip SRAM per SM used for tiling (FlashAttention lives here)
shared memory; SMEM; shared memory, about 228 KB on H100

## L2 cache size on H100
50 MB

## GPU memory hierarchy from fastest to largest
registers, shared memory/L1, L2, HBM

## NVLink per-GPU bandwidth on H100 (gen 4)
900 GB/s

## NVLink per-GPU bandwidth on A100 (gen 3)
600 GB/s

## Typical inter-node interconnect and per-link speed in H100 clusters
InfiniBand NDR at 400 Gb/s; InfiniBand, 400 gigabits per second

## Roughly how much slower is inter-node bandwidth than NVLink?
about 10x; an order of magnitude

## Arithmetic intensity is FLOPs divided by ___
bytes; bytes accessed from HBM

## H100 roofline crossover: FLOPs per HBM byte needed to be compute-bound
about 295; roughly 300

## A100 roofline crossover in FLOPs per byte
about 155; roughly 150

## A bf16 matmul of two square N-by-N matrices has arithmetic intensity of about
N over 3; N/3, so small matrices are memory-bound

## Elementwise ops like ReLU and residual adds are always ___-bound
memory; bandwidth

## Fusing elementwise ops into one kernel helps because it avoids round trips to ___
HBM; global memory

## Every CUDA kernel launch costs a few ___ of overhead
microseconds

## Tool that replays a whole graph of kernels to eliminate per-launch overhead
CUDA graphs; CUDA graph

## In PyTorch, kernel launches are ___ with respect to the CPU
asynchronous; async

## Why must you call torch.cuda.synchronize before timing GPU code?
kernel launches are async, so wall-clock without a sync only measures CPU launch time

## Fraction of an SM's resident-warp capacity in use is called
occupancy

## Adjacent threads reading adjacent addresses is called ___ memory access
coalesced

## OpenAI's Python DSL for writing custom fused GPU kernels
Triton

## Matmul shapes should be multiples of ___ to keep tensor cores fully fed
8; 16; 8 or 16 depending on dtype

## GEMM stands for
general matrix multiply; general matrix-matrix multiplication

## The NVIDIA profiler for kernel-level analysis
Nsight Compute; nsight

## Moving a batch from CPU to GPU without blocking requires pinned memory plus
non_blocking=True; non-blocking copy

## Eight H100s in a node are all-to-all connected through
NVSwitch; NVLink switch
