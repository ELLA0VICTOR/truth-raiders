import { localnet, studionet, testnetAsimov, testnetBradbury } from 'genlayer-js/chains'

const DEFAULT_STUDIO_CONTRACT = '0x23Ccc74B74388e1e6c9665dE7776A761B25521b8'

export const CONTRACT_ADDRESS = import.meta.env.VITE_TRUTH_RAIDERS_CONTRACT_ADDRESS || DEFAULT_STUDIO_CONTRACT
export const ROOM_ID = Number(import.meta.env.VITE_TRUTH_RAIDERS_ROOM_ID || 0)
export const GENLAYER_NETWORK = import.meta.env.VITE_GENLAYER_NETWORK || 'studionet'
export const GENLAYER_RPC_URL = import.meta.env.VITE_GENLAYER_RPC_URL || (GENLAYER_NETWORK === 'bradbury' ? 'https://rpc-bradbury.genlayer.com' : 'https://studio.genlayer.com/api')
export const BRADBURY_CHAIN_ID_HEX = '0x107d'

export const BRADBURY_CHAIN_PARAMS = {
  chainId: BRADBURY_CHAIN_ID_HEX,
  chainName: 'GenLayer Bradbury Testnet',
  rpcUrls: ['https://rpc-bradbury.genlayer.com'],
  nativeCurrency: {
    name: 'GEN Token',
    symbol: 'GEN',
    decimals: 18,
  },
  blockExplorerUrls: ['https://explorer-bradbury.genlayer.com'],
}

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

export async function ensureGenLayerNetwork(provider) {
  if (GENLAYER_NETWORK !== 'bradbury') return
  if (!provider?.request) return

  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: BRADBURY_CHAIN_ID_HEX }],
    })
  } catch (error) {
    const code = error?.code
    const message = String(error?.message || '').toLowerCase()
    const shouldAddChain = code === 4902 || message.includes('unrecognized') || message.includes('not added')

    if (!shouldAddChain) {
      throw error
    }

    await provider.request({
      method: 'wallet_addEthereumChain',
      params: [BRADBURY_CHAIN_PARAMS],
    })
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: BRADBURY_CHAIN_ID_HEX }],
    })
  }
}
