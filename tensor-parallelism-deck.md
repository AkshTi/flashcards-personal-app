# Tensor & pipeline parallelism (Megatron) — deep-dive deck. Import into FlashDesk; each ## question with the short answer line below it becomes one card. Goes beyond parallelism-deck.md into the mechanics interviewers actually probe: column/row splits, where the collectives land, bubble math, and how the strategies compose.

## Megatron splits the first linear layer of the MLP along which dimension of the weight matrix?
column; output dimension; columns

## Megatron splits the second linear layer of the MLP along which dimension?
row; input dimension; rows

## Why column-parallel first, row-parallel second in the MLP?
GeLU applies elementwise to each shard, so no sync is needed between the two GEMMs

## After the row-parallel second GEMM, each device holds a ___ of the output
partial sum; partial

## Which collective combines the row-parallel partial sums?
AllReduce

## How many AllReduces per transformer layer in the Megatron forward pass?
2; two

## How many AllReduces per transformer layer counting forward and backward?
4; four

## In Megatron TP, attention is parallelized by splitting across ___
heads; attention heads

## The QKV projection in Megatron attention is ___-parallel
column

## The attention output projection in Megatron is ___-parallel
row

## In Megatron's f operator, the forward pass is an identity and the backward pass is an ___
AllReduce; all-reduce

## In Megatron's g operator, the forward pass is an AllReduce and the backward pass is an ___
identity

## TP degree is usually capped at 8 because that is the number of GPUs sharing ___
NVLink; a node; NVLink within one node

## Which ops does Megatron TP leave replicated that sequence parallelism then shards?
LayerNorm and dropout; layernorm, dropout

## Sequence parallelism shards activations along which dimension?
sequence; seq; sequence dimension

## Sequence parallelism replaces each TP AllReduce with which two collectives?
AllGather and ReduceScatter; allgather + reducescatter

## Does Megatron sequence parallelism increase communication volume vs plain TP?
no; no, same volume, an AllReduce equals AllGather plus ReduceScatter

## TP communication happens how many times per layer, making it latency-sensitive?
every layer; each layer, so it needs the fastest interconnect

## Pipeline parallelism communicates only ___ between adjacent stages
activations; boundary activations

## Pipeline bubble fraction is roughly (p minus 1) divided by ___
m; microbatches; number of microbatches

## To shrink the pipeline bubble you increase the number of ___
microbatches

## The 1F1B schedule improves on GPipe by reducing ___ memory, not the bubble
activation

## Interleaved (virtual-stage) pipeline scheduling reduces the bubble by giving each device multiple ___
stages; model chunks; virtual stages

## In 3D parallelism, which strategy goes innermost, on the fastest interconnect?
tensor parallelism; TP

## In 3D parallelism, which strategy spans nodes or pods on the slowest links?
data parallelism; DP

## Standard 3D ordering from fastest to slowest interconnect
TP then PP then DP; tensor, pipeline, data

## Total GPUs in a 3D layout equals TP degree times PP degree times ___
DP degree; data-parallel degree

## Expert parallelism places different ___ of an MoE layer on different devices
experts

## Which collective routes tokens to their experts in expert parallelism?
AllToAll; all-to-all

## How many AllToAlls per MoE layer in the forward pass?
2; two, dispatch and combine

## TP slices every weight matrix, so per-device memory for weights falls by a factor of ___
TP degree; N; the TP degree

## Why not just use TP degree 64 instead of adding pipeline parallelism?
AllReduce every layer across slow inter-node links kills throughput; TP is latency-bound

## ZeRO-3/FSDP differs from TP because each device still computes with the ___ layer weights
full; entire; whole

## In FSDP the sharding exists only in ___, gathered before compute
memory; storage; at rest

## Ring AllReduce moves roughly ___ times the tensor bytes per device
2; two; 2(N-1)/N which is about 2

## DP gradient sync volume per step is about 2 times ___ bytes
gradient; parameter; the model's gradient bytes

## Overlapping the DP gradient AllReduce with the backward pass hides comms behind ___
compute; computation; the backward compute

## Context (ring) parallelism shards which tensor across devices for long sequences?
the sequence; activations along sequence; KV blocks along the sequence
