## Which TPU unit performs the matrix multiplies?
MXU; matrix multiply unit

## The MXU is what kind of hardware structure?
systolic array

## Which memory holds the big tensors, tens of GB per chip?
HBM; high bandwidth memory

## The single most important number for memory-bound work is ___ bandwidth
HBM

## On-chip scratchpad near the compute, much higher bandwidth than HBM
VMEM

## Data must be copied from HBM into ___ before the MXU can use it
VMEM

## Which unit does elementwise ops like ReLU, add, and softmax?
VPU; vector processing unit

## VMEM bandwidth is roughly how many times HBM bandwidth?
22; 22x

## Arithmetic intensity needed to hit peak FLOPs from VMEM is about
10 to 20; 10-20; 10

## While the MXU processes chunk K, which chunk is already being copied?
K+1

## In a systolic array a cell computes p_out = ___
p_in + a*w; p_in+a*w

## In a systolic array the weights are ___ while activations flow in from the left
preloaded; stationary; loaded

## How many cores share memory inside one TPU chip?
2; two

## How many chips sit on one tray, connected over PCIe?
4; four

## What links TPU chips to their nearest neighbors in a 2D/3D torus?
ICI; inter-chip interconnect

## As you scale a TPU torus, bandwidth per device stays ___
constant; the same
