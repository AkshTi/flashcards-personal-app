# Training dynamics & debugging deck — optimizer math, schedules, normalization, scaling laws, and the NaN-hunting facts asked in frontier-lab debugging rounds. Import into FlashDesk; each ## question plus the short answer line below becomes one card.

## Adam's first moment update rule
m = beta1 * m + (1 - beta1) * g

## Adam's second moment update rule
v = beta2 * v + (1 - beta2) * g^2

## Adam's parameter update after bias correction
p -= lr * m_hat / (sqrt(v_hat) + eps)

## Adam bias correction divides each moment by
1 - beta^t; one minus beta to the power t

## Typical Adam betas for LLM pretraining
0.9 and 0.95

## How AdamW differs from Adam
weight decay is decoupled, applied directly to weights instead of added to the gradient

## Typical AdamW weight decay for LLM pretraining
0.1

## Why warmup is needed with Adam
early second-moment estimates are noisy, so initial steps are badly scaled without it

## Most common LLM learning-rate schedule after warmup
cosine decay; cosine decay to about 10 percent of peak

## Chinchilla-optimal tokens per parameter
20; about 20

## Chinchilla says for a fixed compute budget, scale params and data in what ratio?
equally; proportionally, both scale with the square root of compute

## Kaplan vs Chinchilla disagreement in one phrase
Kaplan favored bigger models, Chinchilla showed they were undertrained on data

## LayerNorm normalizes over which dimension?
the feature dimension; hidden; last dimension

## RMSNorm drops which two things from LayerNorm?
mean centering and the bias

## Why modern LLMs use pre-norm instead of post-norm
cleaner residual gradient path, stable training without warmup tricks at depth

## Numerically stable softmax subtracts ___ before exponentiating
the max; the row max

## Never compute log(softmax(x)) yourself; use ___ for stability
log_softmax; F.cross_entropy with raw logits; logsumexp

## Xavier/Glorot init keeps what constant across layers?
activation variance; variance of activations

## Kaiming init is designed for which nonlinearity family?
ReLU

## GPT-2 scales residual projections at init by
1 over sqrt(2L); one over the square root of twice the layer count

## Global gradient-norm clipping threshold used by most LLM runs
1.0

## First three suspects when loss goes NaN in fp16
attention logit overflow, learning rate too high, division by zero in a norm

## A loss spike that recovers on its own is usually caused by
a bad data batch; outlier data

## Standard automated response to a loss spike in big runs
skip the batch or restart from checkpoint with data skipped

## Gradient norm rising steadily while loss stalls signals
divergence; instability, lower the LR or check data

## Dead ReLU units are diagnosed by watching for activations that are
always zero; zero for all inputs

## Vanishing gradients in deep nets are countered structurally by
residual connections; skip connections

## Softmax saturation in attention comes from logits growing with
sqrt of head dim; d_k, hence the 1/sqrt(d_k) scaling

## Why divide attention scores by sqrt(d_k)?
keeps logit variance near 1 so softmax stays out of its saturated, tiny-gradient regime

## Label smoothing replaces one-hot targets with
soft targets, 1 - epsilon on the true class and epsilon spread over the rest

## Perplexity in terms of cross-entropy loss L
e^L; exp of the loss

## Bits-per-byte or bits-per-token relates to nats by dividing loss by
ln 2; log 2, about 0.693

## Weight tying shares which two matrices?
input embedding and output unembedding; embedding and LM head

## Dropout at inference time is
disabled; off, model.eval turns it off

## An epoch-over-epoch gap between train and val loss growing means
overfitting

## The LLM pretraining objective in one phrase
next-token prediction; autoregressive cross-entropy

## Batch size too large for a fixed token budget hurts because
fewer optimizer steps; each token is seen in fewer, larger, less frequent updates

## muP (maximal update parametrization) lets you transfer ___ across model sizes
hyperparameters; the learning rate
