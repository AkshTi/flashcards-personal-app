## Name any one of the three LLaMA 3 parameter sizes
8B; 70B; 405B

## FFW params = d_model times d_ff times ___ times n_layers
3

## FLOPs per token during training is about 6 times ___
param_count; parameters; params

## FLOPs per token for LLaMA 70B
4.2e11; 4.2E11

## Total FLOPs to train LLaMA 70B on 15 trillion tokens
6.3e24; 6.3E24

## Which weight matrices dominate LLaMA's parameter count?
FFN; MLP; feed-forward; FFW

## MFU stands for ___
Model FLOPs Utilization

## Training time T = total FLOPs divided by (chips times FLOPs/s times ___)
MFU

## HBM capacity of one TPU chip in the example
96GB; 96 GB; 96e9

## Total HBM to train LLaMA 70B (params + optimizer + checkpoints)
21.6 TB; 21.6TB; 21.6e12

## fp32 Adam optimizer state costs how many bytes per parameter?
8; 8 bytes

## bf16 parameters cost how many bytes each?
2; 2 bytes

## FSDP over sequences is capped by the number of ___
sequences
