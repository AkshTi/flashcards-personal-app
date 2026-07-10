# LLM inference optimization deck — KV cache math, serving systems, and attention efficiency. Import into FlashDesk; each ## question plus the short answer line below becomes one card. This is the material behind "how would you serve this model" interview rounds.

## The two phases of LLM inference
prefill and decode

## Which inference phase is compute-bound?
prefill

## Which inference phase is memory-bandwidth-bound?
decode

## Why is decode memory-bound?
every token reads all weights and the whole KV cache but does only a little math per byte

## Latency metric for the first token
TTFT; time to first token

## Latency metric for each subsequent token
TPOT; time per output token; inter-token latency

## KV cache bytes formula per sequence
2 x layers x kv_heads x head_dim x seq_len x bytes per value

## In the KV cache formula, what does the leading factor 2 count?
K and V; keys and values

## KV cache per token for Llama-70B in bf16 (80 layers, 8 KV heads, head_dim 128)
320 KB; about 320 KB per token

## KV cache for one 8k-token Llama-70B sequence in bf16
about 2.6 GB

## MQA shares one ___ pair across all query heads
KV; key-value; K and V

## GQA with 8 KV groups shrinks the KV cache by what factor vs full MHA with 64 heads?
8x; 8

## GQA trades a tiny quality loss for smaller KV cache and higher decode ___
throughput; batch size

## vLLM's technique that stores KV cache in fixed-size blocks with a page table
PagedAttention

## What waste does PagedAttention eliminate?
fragmentation; internal and external fragmentation from contiguous preallocation

## Scheduling that admits new requests into a running batch every iteration
continuous batching; iteration-level scheduling

## Continuous batching mainly improves which serving metric?
throughput; GPU utilization

## Raising decode batch size raises arithmetic intensity because weights are read once per ___
batch; step, shared across all sequences

## FlashAttention avoids materializing which tensor in HBM?
the N by N attention matrix; attention scores matrix

## FlashAttention computes softmax over tiles using a running max, known as ___ softmax
online

## FlashAttention is exact or approximate?
exact; exact, it is an IO optimization not an approximation

## FlashAttention memory in sequence length N
linear; O(N)

## Speculative decoding: a small ___ model proposes tokens, the target verifies
draft

## Speculative decoding verifies k drafted tokens in how many target forward passes?
1; one

## Why does speculative decoding preserve the target model's exact output distribution?
rejection sampling accepts or resamples each token against the target's probabilities

## Typical speculative decoding speedup
1.5 to 3x; 2x; about 2x

## Speculative decoding helps because decode has idle ___ waiting on memory
compute; FLOPs

## Weight-only int4 quantization helps decode because it shrinks the ___ read per token
weights; bytes; weight bytes

## Common 8-bit serving format on Hopper with per-tensor scales
fp8; fp8 e4m3

## Quantization scheme keeping activations in high precision, weights in int
weight-only quantization; W4A16, W8A16

## Batch=1 decode of a 70B bf16 model on 3.35 TB/s HBM: rough token ceiling
about 24 tokens/s; roughly 140 GB reads at 3.35 TB/s each token

## Prefix caching reuses the KV cache of a shared ___ across requests
prompt; prefix; system prompt

## Chunked prefill interleaves prefill chunks with decode steps to protect ___
TPOT; decode latency; inter-token latency

## Serving throughput unit interviewers ask you to estimate
tokens per second; tokens/s per GPU

## The KV cache limits serving concurrency more than ___ at long contexts
weights; model weights; parameter memory

## Sampling knob that renormalizes over the smallest set of tokens above cumulative prob p
top-p; nucleus sampling

## Temperature 0 decoding is equivalent to
greedy; argmax decoding
