import { useCallback, useMemo, useState } from 'react'
import { createClient } from 'genlayer-js'
import { ExecutionResult, TransactionStatus } from 'genlayer-js/types'
import { ACTIVE_CHAIN, CONTRACT_ADDRESS, GENLAYER_RPC_URL, ROOM_ID, isContractConfigured, switchToBradbury } from '../config/genlayer'

export function useTruthRaidersContract(walletAddress) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const configured = isContractConfigured()

  const readClient = useMemo(() => {
    if (!configured) return null
    return createClient({
      chain: ACTIVE_CHAIN,
      endpoint: GENLAYER_RPC_URL,
    })
  }, [configured])

  const writeClient = useMemo(() => {
    if (!configured || !walletAddress) return null
    const provider = typeof window === 'undefined' ? undefined : window.ethereum
    return createClient({
      chain: ACTIVE_CHAIN,
      endpoint: GENLAYER_RPC_URL,
      account: walletAddress,
      provider,
    })
  }, [configured, walletAddress])

  const writeContract = useCallback(
    async (functionName, args = []) => {
      if (!writeClient || !readClient) {
        throw new Error('Truth Raiders contract is not configured or wallet is not connected.')
      }

      setIsLoading(true)
      setError('')
      try {
        if (window.ethereum) {
          await switchToBradbury(window.ethereum)
        }

        const hash = await writeClient.writeContract({
          address: CONTRACT_ADDRESS,
          functionName,
          args,
        })

        const receipt = await readClient.waitForTransactionReceipt({
          hash,
          status: TransactionStatus.ACCEPTED,
          fullTransaction: false,
        })

        if (receipt.txExecutionResultName === ExecutionResult.FINISHED_WITH_ERROR) {
          throw new Error('Transaction accepted but contract execution failed.')
        }

        return receipt
      } catch (contractError) {
        const message = contractError?.message || `Contract call failed: ${functionName}`
        setError(message)
        throw contractError
      } finally {
        setIsLoading(false)
      }
    },
    [readClient, writeClient]
  )

  const readContract = useCallback(
    async (functionName, args = []) => {
      if (!readClient) {
        throw new Error('Truth Raiders contract is not configured.')
      }

      return readClient.readContract({
        address: CONTRACT_ADDRESS,
        functionName,
        args,
        stateStatus: 'accepted',
      })
    },
    [readClient]
  )

  const getRoom = useCallback(() => {
    return readContract('get_room', [ROOM_ID])
  }, [readContract])

  const getLeaderboard = useCallback(() => {
    return readContract('get_leaderboard', [ROOM_ID])
  }, [readContract])

  const getSubmission = useCallback(
    (roundId, player) => {
      return readContract('get_submission', [ROOM_ID, roundId, player])
    },
    [readContract]
  )

  const joinRoom = useCallback(
    (handle) => {
      return writeContract('join_room', [ROOM_ID, handle, 'scribe'])
    },
    [writeContract]
  )

  const submitRound = useCallback(
    (roundId, chamber, answer, evidenceUrl) => {
      return writeContract('submit_round', [ROOM_ID, roundId, chamber, answer, evidenceUrl])
    },
    [writeContract]
  )

  const scoreRound = useCallback(
    (roundId, player, prompt, rubricCsv) => {
      return writeContract('score_round', [ROOM_ID, roundId, player, prompt, rubricCsv])
    },
    [writeContract]
  )

  const finalizeRoom = useCallback(() => {
    return writeContract('finalize_room', [ROOM_ID])
  }, [writeContract])

  return {
    configured,
    contractAddress: CONTRACT_ADDRESS,
    roomId: ROOM_ID,
    isLoading,
    error,
    getRoom,
    getLeaderboard,
    getSubmission,
    joinRoom,
    submitRound,
    scoreRound,
    finalizeRoom,
  }
}
