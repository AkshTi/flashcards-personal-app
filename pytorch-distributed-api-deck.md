# PyTorch distributed & performance API — type-the-command deck. Import this file into FlashDesk (Import cards → upload). Each ## header + code fence becomes one code card: the front describes the operation, you type the exact PyTorch line(s). Use "Type the answer" mode with Full recall. Companion to pytorch-api-deck.md, going deep on torch.distributed, DDP/FSDP, mixed precision, and profiling.

# Process groups & launch

## Initialize the default process group with the NCCL backend

```python
dist.init_process_group(backend="nccl")
```

## Launch train.py on all 8 local GPUs with torchrun

```python
torchrun --nproc_per_node=8 train.py
```

## Read this process's rank, local rank, and world size from the env (as ints)

```python
rank = int(os.environ["RANK"])
local_rank = int(os.environ["LOCAL_RANK"])
world_size = int(os.environ["WORLD_SIZE"])
```

## Pin this process to its GPU using the local rank

```python
torch.cuda.set_device(local_rank)
```

## Wait for all ranks to reach this line

```python
dist.barrier()
```

## Tear down the process group at the end of training

```python
dist.destroy_process_group()
```

# Collectives

## Sum tensor t across all ranks, result everywhere (in place)

```python
dist.all_reduce(t, op=dist.ReduceOp.SUM)
```

## Average tensor t across all ranks (in place)

```python
dist.all_reduce(t, op=dist.ReduceOp.AVG)
```

## Gather tensor t from every rank into a list of tensors

```python
tensors = [torch.empty_like(t) for _ in range(world_size)]
dist.all_gather(tensors, t)
```

## Reduce-scatter: sum a list of shards so each rank keeps only its slice in out

```python
dist.reduce_scatter(out, shards, op=dist.ReduceOp.SUM)
```

## Broadcast tensor t from rank 0 to all ranks

```python
dist.broadcast(t, src=0)
```

## Run a collective only on rank 0's branch (guard pattern for logging)

```python
if dist.get_rank() == 0:
    print(loss.item())
```

# DDP

## Wrap model in DistributedDataParallel on this process's GPU

```python
model = DDP(model, device_ids=[local_rank])
```

## Skip gradient sync during accumulation steps (context manager)

```python
with model.no_sync():
    loss.backward()
```

## Create a sampler that gives each rank a distinct shard of the dataset

```python
sampler = DistributedSampler(dataset)
```

## Reshuffle the distributed sampler correctly at the start of each epoch

```python
sampler.set_epoch(epoch)
```

# FSDP

## Wrap model with FSDP sharding parameters, grads, and optimizer state

```python
model = FSDP(model, auto_wrap_policy=policy, device_id=local_rank)
```

## FSDP2: shard a module in place with the composable API

```python
fully_shard(model)
```

## Build a 2D device mesh over 4 nodes of 8 GPUs (dp outer, tp inner)

```python
mesh = init_device_mesh("cuda", (4, 8), mesh_dim_names=("dp", "tp"))
```

## Save a full (unsharded) FSDP state dict on rank 0

```python
with FSDP.state_dict_type(model, StateDictType.FULL_STATE_DICT):
    state = model.state_dict()
```

# Mixed precision

## Autocast the forward pass to bf16 on CUDA (context manager)

```python
with torch.autocast(device_type="cuda", dtype=torch.bfloat16):
    loss = model(x).loss
```

## Create a gradient scaler for fp16 training

```python
scaler = torch.amp.GradScaler("cuda")
```

## fp16 backward + step with the scaler (three lines)

```python
scaler.scale(loss).backward()
scaler.step(optimizer)
scaler.update()
```

## Unscale grads before clipping when using GradScaler

```python
scaler.unscale_(optimizer)
torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
```

# Memory & activation checkpointing

## Recompute block(x) in backward instead of storing its activations

```python
out = torch.utils.checkpoint.checkpoint(block, x, use_reentrant=False)
```

## Zero grads without allocating new memory for them

```python
optimizer.zero_grad(set_to_none=True)
```

## Print a full summary of GPU memory usage

```python
print(torch.cuda.memory_summary())
```

## Reset the peak-memory counter before a measurement

```python
torch.cuda.reset_peak_memory_stats()
```

# Performance & profiling

## Compile the model with the default inductor backend

```python
model = torch.compile(model)
```

## Time a GPU region correctly with CUDA events (ms)

```python
start = torch.cuda.Event(enable_timing=True)
end = torch.cuda.Event(enable_timing=True)
start.record()
out = model(x)
end.record()
torch.cuda.synchronize()
ms = start.elapsed_time(end)
```

## Profile CPU and CUDA into a Chrome trace

```python
with torch.profiler.profile(activities=[ProfilerActivity.CPU, ProfilerActivity.CUDA]) as prof:
    model(x)
prof.export_chrome_trace("trace.json")
```

## DataLoader tuned for GPU feeding: 4 workers, pinned memory

```python
loader = DataLoader(ds, batch_size=64, num_workers=4, pin_memory=True)
```

## Enable TF32 matmuls on Ampere+ for free speedup

```python
torch.set_float32_matmul_precision("high")
```

## Use flash/efficient fused attention instead of manual softmax attention

```python
out = F.scaled_dot_product_attention(q, k, v, is_causal=True)
```

## Turn on anomaly detection to find the op that produced a NaN gradient

```python
torch.autograd.set_detect_anomaly(True)
```

## Check whether any entry of tensor t is NaN

```python
torch.isnan(t).any()
```

## Global grad-norm clip to 1.0 (the LLM default)

```python
torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
```
