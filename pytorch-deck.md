## Single-Head Attention

```python
import torch
import torch.nn as nn
import torch.nn.functional as F

class AttentionHead(nn.Module):
    def __init__(self, d_model, d_v):
        super().__init__()
        self.d_model = d_model
        self.d_v = d_v
        self.Q_W = nn.Linear(d_model, d_model, bias=False)
        self.Q_K = nn.Linear(d_model, d_model, bias=False)
        self.Q_V = nn.Linear(d_model, d_v, bias=False)
        self.device = "mps" if torch.backends.mps.is_available() else "cpu"

    def forward(self, x, causal=False):
        q = self.Q_W(x)
        k = self.Q_K(x)
        v = self.Q_V(x)
        scores = q @ k.transpose(-2, -1) / (k.shape[-1] ** 0.5)
        if causal:
            mask = torch.triu(torch.ones(scores.shape[-2:], device=self.device), diagonal=1)
            scores = scores.masked_fill(mask == 1, -float("inf"))
        attn = F.softmax(scores, dim=-1)
        return attn @ v
```

## Multi-Head Attention

```python
import torch
import torch.nn as nn
import torch.nn.functional as F

class MultiHeadAttention(nn.Module):
    def __init__(self, num_heads, d_model):
        super().__init__()
        self.num_heads = num_heads
        self.head_dim = d_model // num_heads
        self.d_model = d_model
        self.layers = nn.ModuleList(
            [AttentionHead(d_model, self.head_dim) for _ in range(num_heads)]
        )
        self.o_proj = nn.Linear(d_model, d_model, bias=False)

    def forward(self, x):
        res = [layer(x) for layer in self.layers]
        val = torch.cat(res, dim=-1)
        return self.o_proj(val)
```

## Transformer Block

```python
import torch
import torch.nn as nn
import torch.nn.functional as F

class TransformerBlock(nn.Module):
    def __init__(self, num_heads, d_model):
        super().__init__()
        self.layer_norm_1 = nn.LayerNorm(d_model)
        self.layer_norm_2 = nn.LayerNorm(d_model)
        self.mlp = nn.Sequential(
            nn.Linear(d_model, 4 * d_model),
            nn.ReLU(),
            nn.Linear(4 * d_model, d_model),
        )
        self.attn = MultiHeadAttention(num_heads, d_model)

    def forward(self, x):
        x = x + self.attn(self.layer_norm_1(x))
        x = x + self.mlp(self.layer_norm_2(x))
        return x
```

## Transformer

```python
import torch
import torch.nn as nn
import torch.nn.functional as F

class Transformer(nn.Module):
    def __init__(self, num_blocks, num_heads, d_model, d_vocab):
        super().__init__()
        self.blocks = nn.ModuleList(
            [TransformerBlock(num_heads, d_model) for _ in range(num_blocks)]
        )
        self.embedding = nn.Embedding(d_vocab, d_model)
        self.output_layer = nn.Linear(d_model, d_vocab)

    def forward(self, x):
        x = self.embedding(x)
        for block in self.blocks:
            x = block(x)
        return self.output_layer(x)
```

## Multi-Class Cross Entropy Loss

```python
def cross_entropy(predicted_probs, true_labels, epsilon=1e-12):
    clipped = torch.clamp(predicted_probs, min=epsilon, max=1.0)
    val = -torch.sum(torch.log(clipped) * true_labels)
    return (val / predicted_probs.shape[0]).item()
```

## Binary Cross Entropy Loss

```python
def binary_cross_entropy(y_pred, y_true, epsilon=1e-12):
    y_pred = torch.clamp(y_pred, min=epsilon, max=1.0 - epsilon)
    loss = -(y_true * torch.log(y_pred) + (1 - y_true) * torch.log(1 - y_pred))
    return torch.sum(loss).item() / y_true.shape[0]
```

## MSE Gradient Descent (batch / SGD / mini-batch)

```python
def train(X, y, weights, learning_rate, n_epochs, method="batch", batch_size=32):
    for _ in range(n_epochs):
        m = X.shape[0]
        if method == "batch":
            gradient = (2 / m) * X.T @ (X @ weights - y)
            weights = weights - gradient * learning_rate
        elif method == "stochastic":
            for i in range(m):
                x = X[i:i+1]
                y_val = y[i:i+1]
                gradient = 2 * x.T @ (x @ weights - y_val)
                weights = weights - gradient * learning_rate
        else:  # mini-batch
            for i in range(0, m, batch_size):
                x = X[i:i+batch_size]
                y_val = y[i:i+batch_size]
                gradient = (2 / x.shape[0]) * x.T @ (x @ weights - y_val)
                weights = weights - gradient * learning_rate
    return weights
```

## Logistic Regression Prediction

```python
def predict_logistic(X: torch.Tensor, weights: torch.Tensor, bias: float) -> torch.Tensor:
    res = X @ weights + bias
    probs = torch.sigmoid(res)
    return probs >= 0.5
```

## K-Means Clustering

```python
def k_means_clustering(points, k, initial_centroids, max_iterations):
    points = torch.tensor(points)
    centroids = torch.tensor(initial_centroids)
    for _ in range(max_iterations):
        distances = torch.cdist(centroids, points)           # [k, N]
        indices = torch.argmin(distances, dim=0)             # [N]
        one_hot = F.one_hot(indices, num_classes=k).float()  # [N, k]
        counts = one_hot.sum(dim=0)                          # [k]
        summed = one_hot.T @ points                          # [k, dim]
        centroids = summed / torch.clamp(counts, min=1.0).unsqueeze(-1)
    return centroids
```

## Momentum Optimizer

```python
def momentum_optimizer(parameter, grad, velocity, learning_rate=0.01, momentum=0.9):
    velocity = momentum * velocity + learning_rate * grad
    parameter = parameter - velocity
    return parameter, velocity
```

## Adam Optimizer

```python
import torch

def adam_optimizer(parameter, grad, m, v, t,
                   learning_rate=0.001, beta1=0.9, beta2=0.999, epsilon=1e-8):
    parameter = torch.as_tensor(parameter, dtype=torch.float64)
    grad = torch.as_tensor(grad, dtype=torch.float64)
    m = torch.as_tensor(m, dtype=torch.float64)
    v = torch.as_tensor(v, dtype=torch.float64)

    m = beta1 * m + (1 - beta1) * grad
    v = beta2 * v + (1 - beta2) * grad ** 2
    m_hat = m / (1 - beta1 ** t)
    v_hat = v / (1 - beta2 ** t)
    parameter = parameter - learning_rate * m_hat / (torch.sqrt(v_hat) + epsilon)
    return (torch.round(parameter, decimals=5),
            torch.round(m, decimals=5),
            torch.round(v, decimals=5))
```

## AdamW Optimizer

```python
import torch

def adamw_update(w, g, m, v, t, lr, beta1, beta2, epsilon, weight_decay):
    w = torch.as_tensor(w, dtype=torch.float64)
    g = torch.as_tensor(g, dtype=torch.float64)
    m = torch.as_tensor(m, dtype=torch.float64)
    v = torch.as_tensor(v, dtype=torch.float64)

    m = beta1 * m + (1 - beta1) * g
    v = beta2 * v + (1 - beta2) * g ** 2
    m_hat = m / (1 - beta1 ** t)
    v_hat = v / (1 - beta2 ** t)
    w = w - lr * weight_decay * w              # decoupled weight decay
    w = w - lr * m_hat / (torch.sqrt(v_hat) + epsilon)
    return (torch.round(w, decimals=5),
            torch.round(m, decimals=5),
            torch.round(v, decimals=5))
```

## Reshape Logits and Labels for Cross Entropy

```python
def reshape_crossentropy(logits, labels):
    batch, seq_len, vocab_size = logits.shape
    logits = logits.view(batch * seq_len, vocab_size)
    labels = labels.view(batch * seq_len)
    return F.cross_entropy(logits, labels)
```

## Perplexity

```python
def perplexity(loss_value):
    return torch.exp(loss_value)
```

## RoPE (Rotary Positional Embeddings)

```python
import torch

def apply_rope(x, positions, base=10000.0):
    seq_len, d = x.shape
    i = torch.arange(0, d // 2, dtype=torch.float32)
    theta = 1.0 / (base ** (2.0 * i / d))
    angles = torch.outer(positions.float(), theta)
    sin_angles = torch.sin(angles)
    cos_angles = torch.cos(angles)

    x_even = x[:, 0::2]
    x_odd = x[:, 1::2]

    x_rot_even = x_even * cos_angles - x_odd * sin_angles
    x_rot_odd = x_even * sin_angles + x_odd * cos_angles

    result = torch.zeros_like(x)
    result[:, 0::2] = x_rot_even
    result[:, 1::2] = x_rot_odd
    return result
```

## Sinusoidal Positional Embeddings

```python
def sinusoidal_pe(seq_len, d, base=10000.0):
    position = torch.arange(seq_len).unsqueeze(1).float()
    i = torch.arange(0, d, 2).float()
    div_term = base ** (-i / d)
    pe = torch.zeros(seq_len, d)
    pe[:, 0::2] = torch.sin(position * div_term)
    pe[:, 1::2] = torch.cos(position * div_term)
    return pe
```

## Learned Positional Embeddings

```python
class LearnedPositionalEmbeddings(nn.Module):
    def __init__(self, max_seq_len, d_model):
        super().__init__()
        self.pos_embedding = nn.Embedding(max_seq_len, d_model)

    def forward(self, x):
        seq_len = x.shape[1]
        positions = torch.arange(seq_len, device=x.device)
        return self.pos_embedding(positions) + x
```

## KV-Cache Attention Step

```python
import torch
import torch.nn as nn
import torch.nn.functional as F

def kv_cache_attention_step(x_new, W_Q, W_K, W_V, cache):
    new_Q = x_new @ W_Q
    new_K = x_new @ W_K
    new_V = x_new @ W_V
    if cache is None:
        K_cache = new_K.unsqueeze(0)
        V_cache = new_V.unsqueeze(0)
    else:
        K_cache = torch.cat([cache[0], new_K.unsqueeze(0)], dim=0)
        V_cache = torch.cat([cache[1], new_V.unsqueeze(0)], dim=0)
    d_k = W_Q.shape[1]
    scores = new_Q @ K_cache.transpose(-2, -1) / (d_k ** 0.5)
    attn = F.softmax(scores, dim=-1)
    out = attn @ V_cache
    return out, (K_cache, V_cache)
```

## Multi-Query Attention (MQA)

```python
class MultiQueryAttention(nn.Module):
    def __init__(self, d_model, n_heads):
        super().__init__()
        head_dim = d_model // n_heads
        self.Q_W = nn.Linear(d_model, d_model)
        self.Q_K = nn.Linear(d_model, head_dim)
        self.Q_V = nn.Linear(d_model, head_dim)

    def forward(self, x):
        q = self.Q_W(x)
        k = self.Q_K(x)
        v = self.Q_V(x)
        return q, k, v
```

## Grouped-Query Attention (GQA)

```python
class GroupedQueryAttention(nn.Module):
    def __init__(self, d_model, n_heads, n_groups):
        super().__init__()
        self.n_heads = n_heads
        self.n_groups = n_groups
        head_dim = d_model // n_heads
        self.Q_W = nn.Linear(d_model, d_model)
        self.Q_K = nn.Linear(d_model, head_dim * n_groups)
        self.Q_V = nn.Linear(d_model, head_dim * n_groups)

    def forward(self, x):
        q = self.Q_W(x)
        k = self.Q_K(x)
        v = self.Q_V(x)
        k = k.repeat_interleave(self.n_heads // self.n_groups, dim=-1)
        v = v.repeat_interleave(self.n_heads // self.n_groups, dim=-1)
        return q, k, v
```
