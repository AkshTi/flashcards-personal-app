## FLOPs of a length-P dot product
2P

## FLOPs of A[N,P] times a vector x
2NP

## FLOPs of A[N,P] times B[P,M]
2NPM

## FLOPs rule of thumb: 2 times the product of every ___ dimension
distinct; unique

## Forward-pass FLOPs of one matmul
2NPM

## Backward-pass FLOPs of one matmul (both gradients)
4NPM

## Total training FLOPs of one matmul, forward plus backward
6NPM

## Training compute is about 6 times params times ___
tokens

## For C = AB, the weight gradient dL/dB = ___ times dL/dC
A^T; A transpose

## For C = AB, the activation gradient dL/dA = dL/dC times ___
B^T; B transpose

## Which letter denotes d_model, the residual stream width?
D

## Which letter denotes d_ff, the MLP hidden width?
F

## Typical ratio of F to D in a transformer MLP
4; 4x; F=4D

## Number of query heads sharing each KV head, G = ___
N/K

## Which letter denotes the query sequence length?
T

## Which letter denotes the key/value sequence length?
S

## A SwiGLU MLP has how many weight matrices (up, gate, down)?
3; three
