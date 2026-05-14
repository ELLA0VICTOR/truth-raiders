import { useCallback, useMemo, useState } from 'react'
import { createClient } from 'genlayer-js'
import { ExecutionResult, TransactionStatus } from 'genlayer-js/types'
import { ACTIVE_CHAIN, CONTRACT_ADDRESS, GENLAYER_RPC_URL, ensureGenLayerNetwork, isContractConfigured } from '../config/genlayer'

export function useTruthRaidersContract(walletAddress, roomId = 0) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const configured = isContractConfigured()
  const activeRoomId = Number.isFinite(Number(roomId)) ? Number(roomId) : 0

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
          await ensureGenLayerNetwork(window.ethereum)
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

  const getRoomById = useCallback((targetRoomId) => {
    return readContract('get_room', [Number(targetRoomId)])
  }, [readContract])

  const getRoom = useCallback(() => {
    return getRoomById(activeRoomId)
  }, [activeRoomId, getRoomById])

  const getLeaderboardById = useCallback((targetRoomId) => {
    return readContract('get_leaderboard', [Number(targetRoomId)])
  }, [readContract])

  const getLeaderboard = useCallback(() => {
    return getLeaderboardById(activeRoomId)
  }, [activeRoomId, getLeaderboardById])

  const getRoomCount = useCallback(() => {
    return readContract('get_room_count')
  }, [readContract])

  const getSubmission = useCallback(
    (roundId, player) => {
      return readContract('get_submission', [activeRoomId, roundId, player])
    },
    [activeRoomId, readContract]
  )

  const createRoom = useCallback(
    (seasonCode, roomCode, roundCount, xpPool) => {
      return writeContract('create_room', [seasonCode, roomCode, roundCount, xpPool])
    },
    [writeContract]
  )

  const joinRoom = useCallback(
    (handle) => {
      return writeContract('join_room', [activeRoomId, handle, 'scribe'])
    },
    [activeRoomId, writeContract]
  )

  const submitRound = useCallback(
    (roundId, chamber, answer, evidenceUrl) => {
      return writeContract('submit_round', [activeRoomId, roundId, chamber, answer, evidenceUrl])
    },
    [activeRoomId, writeContract]
  )

  const scoreRound = useCallback(
    (roundId, player, prompt, rubricCsv) => {
      return writeContract('score_round', [activeRoomId, roundId, player, prompt, rubricCsv])
    },
    [activeRoomId, writeContract]
  )

  const finalizeRoom = useCallback(() => {
    return writeContract('finalize_room', [activeRoomId])
  }, [activeRoomId, writeContract])

  return {
    configured,
    contractAddress: CONTRACT_ADDRESS,
    roomId: activeRoomId,
    isLoading,
    error,
    getRoom,
    getRoomById,
    getLeaderboard,
    getLeaderboardById,
    getRoomCount,
    getSubmission,
    createRoom,
    joinRoom,
    submitRound,
    scoreRound,
    finalizeRoom,
  }
}
