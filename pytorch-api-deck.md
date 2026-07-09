# PyTorch API — type-the-command deck

Import this file into FlashDesk (Import cards → upload). Each `##` header + code fence becomes one code card: the front describes the operation, you type the exact PyTorch line(s). Use "Type the answer" mode with Full recall.

# Tensor creation

## Create a tensor directly from a Python list `[[1, 2], [3, 4]]`

```python
torch.tensor([[1, 2], [3, 4]])
```

## Create a 3×4 tensor of zeros

```python
torch.zeros(3, 4)
```

## Create a 3×4 tensor of ones

```python
torch.ones(3, 4)
```

## Create a 3×4 tensor of standard-normal random values

```python
torch.randn(3, 4)
```

## Create a 3×4 tensor of uniform random values in [0, 1)

```python
torch.rand(3, 4)
```

## Create a 3×4 tensor of random integers from 0 to 9

```python
torch.randint(0, 10, (3, 4))
```

## Integers 0..9 as a 1-D tensor

```python
torch.arange(10)
```

## 50 evenly spaced values from 0 to 1 (inclusive)

```python
torch.linspace(0, 1, 50)
```

## 4×4 identity matrix

```python
torch.eye(4)
```

## 3×4 tensor filled with the value 7

```python
torch.full((3, 4), 7)
```

## Zeros with the same shape/dtype/device as tensor x

```python
torch.zeros_like(x)
```

## Standard-normal noise with the same shape/dtype/device as x

```python
torch.randn_like(x)
```

## Set the global random seed to 42 for reproducibility

```python
torch.manual_seed(42)
```

# Shape surgery

## Reshape x to (batch, -1), requiring contiguous memory

```python
x.view(batch, -1)
```

## Reshape x to (batch, -1), copying if needed (always works)

```python
x.reshape(batch, -1)
```

## Swap dims 1 and 2 of x

```python
x.transpose(1, 2)
```

## Swap the last two dims of x (attention-score idiom)

```python
x.transpose(-2, -1)
```

## Reorder dims of x from (B, T, H, D) to (B, H, T, D)

```python
x.permute(0, 2, 1, 3)
```

## Add a new dimension of size 1 at position 0

```python
x.unsqueeze(0)
```

## Remove the dimension of size 1 at position -1

```python
x.squeeze(-1)
```

## Flatten x completely into 1-D

```python
x.flatten()
```

## Concatenate tensors a and b along the last dim

```python
torch.cat([a, b], dim=-1)
```

## Stack tensors a and b along a NEW first dim

```python
torch.stack([a, b], dim=0)
```

## Split x into chunks of size 512 along dim 0

```python
torch.split(x, 512, dim=0)
```

## Split x into 4 equal chunks along dim 0

```python
torch.chunk(x, 4, dim=0)
```

## Broadcast-expand x of shape (1, T, D) to (B, T, D) without copying

```python
x.expand(B, T, D)
```

## Tile x by repeating it 2× along dim 0 (copies data)

```python
x.repeat(2, 1)
```

## Repeat each element of k 4 times along the head dim (GQA idiom)

```python
k.repeat_interleave(4, dim=1)
```

## Make x contiguous in memory (after permute/transpose)

```python
x.contiguous()
```

## Check whether x is contiguous

```python
x.is_contiguous()
```

# Indexing, masking, selection

## Gather values from logits along dim -1 at positions `labels.unsqueeze(-1)`

```python
logits.gather(-1, labels.unsqueeze(-1))
```

## Elementwise: where mask is true take a, else b

```python
torch.where(mask, a, b)
```

## Fill scores with -inf wherever mask == 1 (returns new tensor)

```python
scores.masked_fill(mask == 1, -float("inf"))
```

## Upper-triangular of a ones matrix, excluding the diagonal (causal mask)

```python
torch.triu(torch.ones(T, T), diagonal=1)
```

## Top 5 values and their indices along the last dim

```python
torch.topk(x, 5, dim=-1)
```

## Index of the max along the last dim

```python
x.argmax(dim=-1)
```

## Sort x descending along the last dim

```python
torch.sort(x, dim=-1, descending=True)
```

## Select rows 0, 2, 5 of x using a tensor of indices idx

```python
torch.index_select(x, 0, idx)
```

## Boolean mask of elements of x that are NaN

```python
torch.isnan(x)
```

## True if any element of x is NaN (as a Python bool)

```python
torch.isnan(x).any().item()
```

# Math & reductions

## Matrix multiply q and k-transposed with the @ operator

```python
q @ k.transpose(-2, -1)
```

## Batched matrix multiply of a (B, T, D) and b (B, D, T)

```python
torch.bmm(a, b)
```

## Outer product of vectors positions and theta (RoPE idiom)

```python
torch.outer(positions, theta)
```

## Einsum for batched attention scores from q and k: (b h t d, b h s d -> b h t s)

```python
torch.einsum("bhtd,bhsd->bhts", q, k)
```

## Mean of x over the last dim, KEEPING the dim

```python
x.mean(dim=-1, keepdim=True)
```

## Sum of x over dim 0

```python
x.sum(dim=0)
```

## Max VALUES of x along dim -1 (just the values)

```python
x.max(dim=-1).values
```

## Clamp x between 1e-12 and 1.0

```python
torch.clamp(x, min=1e-12, max=1.0)
```

## L2 norm of x along the last dim

```python
x.norm(dim=-1)
```

## Pairwise Euclidean distances between rows of a and rows of b

```python
torch.cdist(a, b)
```

## Softmax over the last dim of scores

```python
F.softmax(scores, dim=-1)
```

## Log-softmax over the last dim of logits

```python
F.log_softmax(logits, dim=-1)
```

## One-hot encode integer tensor idx with k classes, as float

```python
F.one_hot(idx, num_classes=k).float()
```

## Numerically-stable exp trick: subtract the max over the last dim first

```python
x - x.max(dim=-1, keepdim=True).values
```

# Autograd & debugging

## Turn on gradient tracking for tensor w in place

```python
w.requires_grad_(True)
```

## Backprop from scalar loss

```python
loss.backward()
```

## Read the accumulated gradient of parameter w

```python
w.grad
```

## Context manager that disables autograd (inference)

```python
with torch.no_grad():
```

## Detach x from the graph (no gradient flows through)

```python
x.detach()
```

## Get the Python number out of a 0-dim tensor

```python
loss.item()
```

## Compute grad of loss w.r.t. x without touching .grad (functional API)

```python
torch.autograd.grad(loss, x)
```

## Enable anomaly detection to find the op that produced NaN gradients

```python
torch.autograd.set_detect_anomaly(True)
```

## Clip global grad norm of model parameters to 1.0

```python
torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
```

## Register a hook on tensor t that prints its gradient

```python
t.register_hook(lambda g: print(g))
```

## Assert a and b are numerically close (testing)

```python
torch.testing.assert_close(a, b)
```

## True/False: are a and b elementwise close within tolerance?

```python
torch.allclose(a, b)
```

## Print the shape and dtype of x (first debugging move)

```python
print(x.shape, x.dtype)
```

# nn building blocks

## Linear layer d_model → d_model without bias

```python
nn.Linear(d_model, d_model, bias=False)
```

## Embedding table: vocab size V, dimension d_model

```python
nn.Embedding(V, d_model)
```

## LayerNorm over the last dim of size d_model

```python
nn.LayerNorm(d_model)
```

## Dropout with probability 0.1

```python
nn.Dropout(0.1)
```

## A list of 12 TransformerBlock modules that autograd can see

```python
nn.ModuleList([TransformerBlock(...) for _ in range(12)])
```

## MLP: Linear d→4d, ReLU, Linear 4d→d, as one module

```python
nn.Sequential(nn.Linear(d, 4 * d), nn.ReLU(), nn.Linear(4 * d, d))
```

## Register tensor t as a learnable parameter of a module

```python
self.w = nn.Parameter(t)
```

## Cross-entropy loss from logits (N, C) and integer labels (N,)

```python
F.cross_entropy(logits, labels)
```

## MSE loss between pred and target

```python
F.mse_loss(pred, target)
```

## Count total parameters of model

```python
sum(p.numel() for p in model.parameters())
```

## Count only TRAINABLE parameters of model

```python
sum(p.numel() for p in model.parameters() if p.requires_grad)
```

## Freeze every parameter of model (feature extraction)

```python
for p in model.parameters(): p.requires_grad = False
```

## Xavier-uniform init of weight w in place

```python
nn.init.xavier_uniform_(w)
```

# Train / eval / checkpoints

## Put model in training mode (dropout on, BN updating)

```python
model.train()
```

## Put model in eval mode (dropout off, BN frozen)

```python
model.eval()
```

## Save model weights to "ckpt.pt"

```python
torch.save(model.state_dict(), "ckpt.pt")
```

## Load weights from "ckpt.pt" into model

```python
model.load_state_dict(torch.load("ckpt.pt"))
```

## AdamW over model params, lr 3e-4, weight decay 0.1

```python
torch.optim.AdamW(model.parameters(), lr=3e-4, weight_decay=0.1)
```

## The three lines of one optimizer step, in order

```python
optimizer.zero_grad()
loss.backward()
optimizer.step()
```

## Cosine-annealing LR schedule over T_max steps

```python
torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=T_max)
```

## DataLoader: batch size 32, shuffled

```python
DataLoader(dataset, batch_size=32, shuffle=True)
```

## The two methods every map-style Dataset must implement

```python
__len__ and __getitem__
```

# Device, dtype, performance

## Best available device string: cuda, else mps, else cpu

```python
"cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu"
```

## Move model to device (in place for modules)

```python
model.to(device)
```

## Move batch x to device without blocking the host

```python
x.to(device, non_blocking=True)
```

## Cast x to bfloat16

```python
x.to(torch.bfloat16)
```

## Cast x to float32

```python
x.float()
```

## Mixed-precision forward pass context (CUDA, bf16)

```python
with torch.autocast(device_type="cuda", dtype=torch.bfloat16):
```

## Compile model for faster training (PyTorch 2.x)

```python
torch.compile(model)
```

## Block until all queued CUDA kernels finish (needed before timing)

```python
torch.cuda.synchronize()
```

## Bytes of GPU memory currently allocated by tensors

```python
torch.cuda.memory_allocated()
```

## Peak GPU memory allocated since start (find the OOM moment)

```python
torch.cuda.max_memory_allocated()
```

# Distributed (the essentials)

## Sum tensor t across all ranks in place (default op)

```python
dist.all_reduce(t)
```

## Wrap model for data-parallel training across GPUs

```python
DistributedDataParallel(model, device_ids=[local_rank])
```

## Get this process's rank and the world size

```python
dist.get_rank(), dist.get_world_size()
```
