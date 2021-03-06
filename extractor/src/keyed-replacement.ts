import pth from 'path';
import fse from 'fs-extra';
import globby from 'globby';

import {
  TAG_NAME_LANGUAGE_DATA,
  TEXT_EN,
  TEXT_TODO,
  TEXT_UNUSED,
  TEXT_NEWLINE,
} from './constants';

import { ExtractorEventEmitter } from './extractor-event-emitter';
import {
  XNodeData,
  XTextData,
  XCommentData,
  XElementData,
  loadXML,
  PrettierOptions,
  resolveXmlPrettierOptions,
  saveXML,
} from './xml';

export interface KeyedReplacement {
  key: string;
  origin: string;
  translation: string;
  unused?: boolean;
  duplicated?: boolean;
}

export interface KeyedReplacementMap {
  [fileName: string]: (string | KeyedReplacement)[];
}

export class KeyedReplacementExtractor {
  private readonly emitter: ExtractorEventEmitter;

  public constructor(emitter: ExtractorEventEmitter) {
    this.emitter = emitter;
  }

  // ----------------------------------------------------------------
  // Loading

  /**
   * Load `Keyed` xml document files of the mod.
   * @param directory the path to the directory 'Keyed' of the mod for the specified language
   */
  public async load(directory: string): Promise<KeyedReplacementMap> {
    if (!(await fse.pathExists(directory))) {
      return {};
    }

    const files = await globby(['**/*.xml'], {
      cwd: directory,
      onlyFiles: true,
      caseSensitiveMatch: false,
    });

    const map: KeyedReplacementMap = {};

    await Promise.all(
      files.map(async fileName => {
        const path = pth.join(directory, fileName);
        map[fileName] = await this.loadFile(path);
      }),
    );

    return map;
  }

  private async loadFile(path: string): Promise<(string | KeyedReplacement)[]> {
    const root = await loadXML(path);
    const keyedList: (string | KeyedReplacement)[] = [];

    let comment = '';
    let origin = '';
    root.childNodes.forEach(node => {
      switch (node.nodeType) {
        case 'comment':
          comment = node.value.trim();
          if (comment === TEXT_UNUSED) {
            // do nothing
          } else if (comment.startsWith(TEXT_EN)) {
            origin = comment.replace(TEXT_EN, '').trim();
          } else {
            keyedList.push(comment);
          }
          break;

        case 'element':
          keyedList.push({
            key: node.name,
            origin,
            translation: node.value,
          });
          origin = '';
          break;

        default:
          if (node.value.split(/\r|\n|\r\n/).length > 2) {
            keyedList.push(TEXT_NEWLINE);
          }
      }
    });

    return keyedList;
  }

  // ----------------------------------------------------------------
  // Merging

  /**
   * Merge old translation keyed map to the origin keyed map, return a new map
   * @param originMap the origin(English) keyed map
   * @param oldMap the old translation keyed map
   */
  public merge(
    originMap: KeyedReplacementMap,
    oldMap: KeyedReplacementMap,
  ): KeyedReplacementMap {
    const newMap: KeyedReplacementMap = {};

    Object.entries(originMap).forEach(([fileName, keyedList]) => {
      newMap[fileName] = keyedList.map<string | KeyedReplacement>(keyed => {
        if (typeof keyed === 'string') {
          return keyed;
        }
        return {
          key: keyed.key,
          origin: keyed.translation,
          translation: TEXT_TODO,
        };
      });
    });

    Object.entries(oldMap).forEach(([fileName, oldKeyedList]) => {
      const newKeyedList = newMap[fileName] || (newMap[fileName] = []);

      const unusedKeyeds = [] as KeyedReplacement[];
      const endComments = [] as string[];

      oldKeyedList.forEach(oldKeyed => {
        if (typeof oldKeyed === 'string') {
          if (oldKeyed === TEXT_NEWLINE) {
            return;
          }
          if (!newKeyedList.includes(oldKeyed)) {
            endComments.push(oldKeyed);
          }
          return;
        }
        const newKeyed = newKeyedList.find(
          (k): k is KeyedReplacement => typeof k === 'object' && k.key === oldKeyed.key,
        );
        if (!newKeyed) {
          unusedKeyeds.push(oldKeyed);
          return;
        }
        if (
          oldKeyed.translation &&
          oldKeyed.translation !== TEXT_TODO &&
          oldKeyed.translation !== newKeyed.origin
        ) {
          newKeyed.translation = oldKeyed.translation;
        }
      });

      if (unusedKeyeds.length > 0) {
        newKeyedList.push(
          TEXT_NEWLINE,
          ...unusedKeyeds.map(keyed => ({
            ...keyed,
            unused: true,
          })),
        );
      }

      if (endComments.length > 0) {
        newKeyedList.push(TEXT_NEWLINE, ...endComments);
      }
    });

    return newMap;
  }

  // ----------------------------------------------------------------
  // Checking Duplicated

  /**
   * Check duplicated keyed, should be call after `merge()`.
   * @param keyedReplacementMaps the array of `KeyedReplacementMap`, `[Core, ...Mods]`
   */
  public checkDuplicated(keyedReplacementMaps: KeyedReplacementMap[]): void {
    const visited = new Set<string>();

    keyedReplacementMaps.forEach(map =>
      Object.keys(map)
        .sort()
        .forEach(fileName => {
          const keyedList = map[fileName];
          keyedList.forEach(keyed => {
            if (typeof keyed === 'string') {
              return;
            }
            if (visited.has(keyed.key)) {
              keyed.duplicated = true;
              return;
            }
            visited.add(keyed.key);
          });
        }),
    );
  }

  // ----------------------------------------------------------------
  // Saving

  /**
   * Save `KeyedReplacementMap` as XML document files.
   * @param directory the directory to save to
   * @param keyedReplaceMap the `KeyedReplacementMap`
   * @param prettierOptions format options
   */
  public async save(
    directory: string,
    keyedReplaceMap: KeyedReplacementMap,
    prettierOptions?: PrettierOptions,
  ): Promise<void> {
    await Promise.all(
      Object.entries(keyedReplaceMap).map(async ([fileName, keyedList]) => {
        const path = pth.join(directory, fileName);
        await this.saveFile(path, keyedList, prettierOptions);
      }),
    );
  }

  private async saveFile(
    path: string,
    keyedList: (string | KeyedReplacement)[],
    prettierOptions?: PrettierOptions,
  ): Promise<void> {
    const { tab, indent, eol, newline } = resolveXmlPrettierOptions(prettierOptions);

    const blocks: XNodeData[][] = [];
    let currentBlock: XNodeData[] = [];
    blocks.push(currentBlock);
    keyedList.forEach(keyed => {
      if (typeof keyed === 'string') {
        if (keyed === TEXT_NEWLINE) {
          currentBlock = [];
          blocks.push(currentBlock);
          return;
        }
        currentBlock.push(
          indent,
          {
            nodeType: 'comment',
            value: ` ${keyed} `,
          },
          newline,
        );
        return;
      }
      if (keyed.duplicated) {
        return;
      }
      if (keyed.unused) {
        currentBlock.push(
          indent,
          {
            nodeType: 'comment',
            value: ` ${TEXT_UNUSED} `,
          },
          newline,
        );
      }
      currentBlock.push(
        indent,
        { nodeType: 'comment', value: ` ${TEXT_EN} ${keyed.origin} ` },
        newline,
        indent,
        {
          nodeType: 'element',
          name: keyed.key,
          attributes: {},
          childNodes: [{ nodeType: 'text', value: keyed.translation }],
          elements: [],
          value: keyed.translation,
        },
        newline,
      );
    });

    const childNodes: XNodeData[] = [newline, newline];

    blocks.forEach(block => {
      if (block.length > 0) {
        childNodes.push(...block, newline);
      }
    });

    const languageData: XElementData = {
      nodeType: 'element',
      name: TAG_NAME_LANGUAGE_DATA,
      attributes: {},
      childNodes,
      elements: childNodes.filter((c): c is XElementData => c.nodeType === 'element'),
      value: '',
    };

    await saveXML(path, languageData, false, prettierOptions);
  }
}
