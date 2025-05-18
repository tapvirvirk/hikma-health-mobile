/**
 * Sync utilities for both local and remote sync processes
 *
 * @module sync
 */
import * as O from "fp-ts/Option"
import { MMKV } from "react-native-mmkv"
import { ServerType } from "../types"
import { pipe } from "fp-ts/lib/function"

const storage = new MMKV()

type SyncServerKey = `${ServerType}-sync-server`

/**
 * Sync Server settings and management
 * Servers are stored by key value pairs Record<SyncServerKey, SyncServer> where SyncServer is stored as JSON
 * @namespace SyncServer
 */
export namespace SyncServer {
  export type T = {
    id: string
    name: ServerType
    type: ServerType
    url: string
    isActive: boolean
  }

  /**
   * Get the last pull timestamp from storage
   * @param serverType The type of server to get the last pull timestamp for
   * @returns {number} The last pull timestamp
   */
  export function getLastPullTimestamp(serverType: ServerType): number {
    return pipe(
      O.fromNullable(storage.getNumber(`${serverType}LastPullTimestamp`)),
      O.getOrElse(() => 0),
    )
  }

  /**
   * Set the last pull timestamp in storage
   * @param serverType The type of server to set the last pull timestamp for
   * @param timestamp The timestamp to set
   * @returns {Promise<void>} A promise that resolves when the last pull timestamp is set
   */
  export function setLastPullTimestamp(serverType: ServerType, timestamp: number): Promise<void> {
    try {
      storage.set(`${serverType}LastPullTimestamp`, timestamp)
      return Promise.resolve()
    } catch (error) {
      console.error("Failed to set last pull timestamp", error)
      return Promise.reject(error)
    }
  }

  /** Get all the sync Servers */
  export function getAll(): Promise<Record<SyncServerKey, T>> {
    // @ts-expect-error this expects the  keys to be defined ahead of time
    let result: Record<SyncServerKey, T> = {}
    const local = storage.getString("local-sync-server")
    const cloud = storage.getString("cloud-sync-server")
    if (local) {
      try {
        result["local-sync-server"] = JSON.parse(local)
      } catch (error) {
        console.error("Failed to parse local sync server", error)
      }
    }
    if (cloud) {
      try {
        result["cloud-sync-server"] = JSON.parse(cloud)
      } catch (error) {
        console.error("Failed to parse cloud sync server", error)
      }
    }
    return Promise.resolve(result)
  }

  /** Get a specific sync Server by id */
  export function getById(id: SyncServerKey): Promise<T | null> {
    return getAll().then((servers) => servers[id] ?? null)
  }

  /** Get a specific sync server by server type */
  export function getByType(type: ServerType): Promise<T | null> {
    return getAll().then((servers) => servers[`${type}-sync-server`] ?? null)
  }

  /**
   * Set a sync server by server type
   * @param {ServerType} serverType The type of server to set
   * @param {T} server The sync server to set
   * @returns {Promise<void>} A promise that resolves when the sync server is set
   */
  export function set(serverType: ServerType, server: T): Promise<void> {
    try {
      storage.set(`${serverType}-sync-server`, JSON.stringify(server))
      return Promise.resolve()
    } catch (error) {
      console.error("Failed to set sync server", error)
      return Promise.reject(error)
    }
  }

  /**
   * Remove a sync server by server type
   * @param {ServerType} serverType The type of server to remove
   * @returns {Promise<void>} A promise that resolves when the sync server is removed
   */
  export function remove(serverType: ServerType): Promise<void> {
    try {
      storage.delete(`${serverType}-sync-server`)
      return Promise.resolve()
    } catch (error) {
      console.error("Failed to remove sync server", error)
      return Promise.reject(error)
    }
  }

  /**
   * Get the currently active server for syncing
   * @returns {Promise<T | null>} A promise that resolves to the currently active sync server
   */
  export function getActive(): Promise<T | null> {
    return getAll().then((servers) => {
      for (const key in servers) {
        if (servers[key as SyncServerKey].isActive) {
          return servers[key as SyncServerKey]
        }
      }
      return null
    })
  }

  /**
   * Set the currently active server for syncing
   * @param {ServerType} serverType The type of server to set as active
   * @returns {Promise<void>} A promise that resolves when the active server is set
   */
  export function setActive(serverType: ServerType): Promise<void> {
    return getAll().then((servers) => {
      const promises: Promise<void>[] = []

      for (const key in servers) {
        const server = servers[key as SyncServerKey]
        if (server.type === serverType) {
          promises.push(set(server.type, { ...server, isActive: true }))
        } else if (server.isActive) {
          promises.push(set(server.type, { ...server, isActive: false }))
        }
      }

      return Promise.all(promises).then(() => {})
    })
  }
}
