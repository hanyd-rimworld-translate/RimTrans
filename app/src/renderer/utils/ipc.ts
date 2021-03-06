/* eslint-disable @typescript-eslint/no-explicit-any */
import { remote, IpcRendererEvent, ipcRenderer } from 'electron';
import Vue, { PluginFunction } from 'vue';
import {
  Component,
  Emit,
  Inject,
  Model,
  Prop,
  Provide,
  Watch,
} from 'vue-property-decorator';
import { cloneObject } from '@src/main/utils/object';
import { IpcTypeMap, IpcMessage } from '@src/main/utils/ipc';

export type IpcRendererListener<T> = (
  event: IpcRendererEvent,
  message: IpcMessage<T>,
) => any;

/**
 * The IPC interface for renderer interface.
 */
export interface IpcRenderer<T extends any = IpcTypeMap> {
  /**
   * Add listener to ipc in specified channel.
   * This is for get message from the main process.
   * @param channel the ipc channel
   * @param listener the ipc listener function
   */
  on<K extends keyof T>(channel: K, listener: IpcRendererListener<T[K][0]>): void;

  /**
   * Add listener to ipc in specified channel.
   * This is for get message from the main process.
   * Will be remove after called.
   * @param channel the ipc channel
   * @param listener the ipc listener function
   */
  once<K extends keyof T>(channel: K, listener: IpcRendererListener<T[K][0]>): void;

  /**
   * Send a message to the main process via ipc in specified channel.
   * @param channel the ipc channel
   * @param message the message to send
   */
  send<K extends keyof T>(channel: K, message: IpcMessage<T[K][0]>): void;

  /**
   * Remove the ipc listener in specified channel.
   * @param channel the ipc channel
   * @param listener the ipc listener function
   */
  removeListener<K extends keyof T>(
    channel: K,
    listener: IpcRendererListener<T[K][0]>,
  ): void;

  /**
   * Remove all of listeners in specified channels.
   * @param channels the ipc channels
   */
  removeAllListener<K extends keyof T>(...channels: K[]): void;

  request<K extends keyof T>(channel: K, data: T[K][0]): Promise<T[K][1]>;
}

export const currentWindowId: number = remote.getCurrentWindow().id;

let requestCount = 0;

/**
 * Generate a message id to send.
 */
export function generateIpcId(): string {
  requestCount += 1;
  return [currentWindowId, Date.now(), Math.floor(Math.random() * 1000)]
    .map(n => n.toString(16))
    .join('-');
}

/**
 * Create a IPC interface for the renderer process.
 */
export function createIpc<T extends any = IpcTypeMap>(namespace: string): IpcRenderer<T> {
  if (!namespace) {
    throw new Error("Must provide the argument 'namespace'");
  }

  return {
    on(channel, listener) {
      ipcRenderer.on(`${namespace}-${channel}`, listener);
    },
    once(channel, listener) {
      ipcRenderer.once(`${namespace}-${channel}`, listener);
    },

    send(channel, message) {
      ipcRenderer.send(`${namespace}-${channel}`, cloneObject(message));
    },

    removeListener(channel, listener) {
      ipcRenderer.removeListener(`${namespace}-${channel}`, listener);
    },
    removeAllListener(...channels) {
      channels.forEach(channel => {
        ipcRenderer.removeAllListeners(`${namespace}-${channel}`);
      });
    },

    request<K extends keyof T>(channel: K, data: T[K][0]): Promise<T[K][1]> {
      return new Promise<T[K][1]>((resolve, reject) => {
        const realChannel = `${namespace}-${channel}`;
        const id = generateIpcId();
        const message = { id, data };

        const listener = (
          event: IpcRendererEvent,
          replyMessage: IpcMessage<T[K][1]>,
          error?: Error,
        ): void => {
          if (replyMessage.id !== id) {
            return;
          }
          ipcRenderer.removeListener(realChannel, listener);
          if (error) {
            reject(error);
            return;
          }
          resolve(replyMessage.data);
        };

        ipcRenderer.on(realChannel, listener);
        ipcRenderer.send(realChannel, cloneObject(message));
      });
    },
  };
}

// ------------------------------------------------
// Global

/**
 * Get global value of the main process.
 * @param key the name of the global value.
 */
export function getGlobal<T>(key: string): T {
  return JSON.parse(JSON.stringify(remote.getGlobal(key)));
}
