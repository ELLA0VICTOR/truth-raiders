import { localnet, studionet, testnetAsimov, testnetBradbury } from 'genlayer-js/chains'

const DEFAULT_BRADBURY_CONTRACT = '0x5665FdEaBb3f46ddE3dF89467505c493BdF4ed41'

export const CONTRACT_ADDRESS = import.meta.env.VITE_TRUTH_RAIDERS_CONTRACT_ADDRESS || DEFAULT_BRADBURY_CONTRACT
export const ROOM_ID = Number(import.meta.env.VITE_TRUTH_RAIDERS_ROOM_ID || 0)
export const GENLAYER_NETWORK = import.meta.env.VITE_GENLAYER_NETWORK || 'bradbury'

const CHAINS = {
  localnet,
  studionet,
  asimov: testnetAsimov,
  bradbury: testnetBradbury,
}

export const ACTIVE_CHAIN = CHAINS[GENLAYER_NETWORK] || studionet

export function isContractConfigured() {
  return /^0x[a-fA-F0-9]{40}$/.test(CONTRACT_ADDRESS)
}
