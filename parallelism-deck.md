## In data parallelism, activations are sharded along which dimension?
batch; B

## In data parallelism, parameters and optimizer state are ___ on every device
replicated; duplicated

## Data parallelism synchronizes gradients using which collective?
AllReduce

## The data-parallel gradient AllReduce happens on which pass?
backward; backward pass

## Which collective sums N full partials into one result everywhere?
AllReduce

## Which collective concatenates N fragments into the whole array?
AllGather

## Which collective sums partials but gives each chip only its slice?
ReduceScatter

## AllReduce equals AllGather plus ___
ReduceScatter

## In FSDP, sharded parameters are ___ just in time before the forward pass
all-gathered; gathered; allgathered

## FSDP scatters the summed weight gradient using which collective?
ReduceScatter

## Which ZeRO stage shards only the optimizer state?
ZeRO-1; zero-1; 1

## Which ZeRO stage also shards the weights themselves?
ZeRO-3; zero-3; 3

## In tensor parallelism, weights are sharded along which dimension?
F

## In tensor parallelism, activations are sharded along which dimension?
D

## Tensor parallelism lets you add chips without increasing the ___
batch; batch size

## Pipeline parallelism shards weights along which dimension?
layer; layers; layer dimension

## Wasted idle time in pipeline parallelism is called the ___
bubble; pipeline bubble

## The pipeline bubble is reduced by ___
microbatching; microbatches

## Fast interconnect between chips inside a pod is called
ICI

## Slower interconnect between separate pods is called
DCN

## Across the slow DCN boundary you should use plain ___ parallelism
data; data parallelism

## Per-chip token count needed to stay compute-bound in the example is about
2550
