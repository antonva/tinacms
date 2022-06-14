/**

Copyright 2021 Forestry.io Holdings, Inc.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

*/

import React from 'react'
import { useEffect, useState } from 'react'
import { useCMS } from '../../react-tinacms/use-cms'
import { BiCloudUpload } from 'react-icons/bi'
import {
  Modal,
  ModalHeader,
  ModalBody,
  FullscreenModal,
} from '../../packages/react-modals'
import {
  MediaList,
  Media,
  MediaListOffset,
  MediaListError,
} from '../../packages/core'
import path from 'path'
import { Button } from '../../packages/styles'
import { useDropzone } from 'react-dropzone'
import { CursorPaginator } from './pagination'
import { MediaItem } from './media-item'
import { Breadcrumb } from './breadcrumb'
import { LoadingDots } from '../../packages/form-builder'

export interface MediaRequest {
  basepath?: string
  directory?: string
  onSelect?(media: Media): void
  close?(): void
  allowDelete?: boolean
}

export function MediaManager() {
  const cms = useCMS()

  const [request, setRequest] = useState<MediaRequest | undefined>()

  useEffect(() => {
    return cms.events.subscribe('media:open', ({ type, ...request }) => {
      setRequest(request)
    })
  }, [])

  if (!request) return null

  const close = () => setRequest(undefined)

  return (
    <Modal>
      <FullscreenModal>
        <ModalHeader close={close}>Media Manager</ModalHeader>
        <ModalBody>
          <MediaPicker {...request} close={close} />
        </ModalBody>
      </FullscreenModal>
    </Modal>
  )
}

type MediaListState = 'loading' | 'loaded' | 'error' | 'not-configured'

const defaultListError = new MediaListError({
  title: 'Error fetching media',
  message: 'Something went wrong while requesting the resource.',
  docsLink: 'https://tina.io/docs/media/#media-store',
})

export function MediaPicker({
  allowDelete,
  onSelect,
  close,
  ...props
}: MediaRequest) {
  const cms = useCMS()
  const [listState, setListState] = useState<MediaListState>(() => {
    if (cms.media.isConfigured) return 'loading'
    return 'not-configured'
  })

  const [listError, setListError] = useState<MediaListError>(defaultListError)

  let directoryWithPath: string | undefined = undefined
  if (cms.mediabasepath) {
    directoryWithPath = cms.mediabasepath
  }
  if (directoryWithPath && props.directory) {
    directoryWithPath += props.directory
  } else {
    directoryWithPath = props.directory
  }

  const [directory, setDirectory] = useState<string | undefined>(
    directoryWithPath
  )

  const [list, setList] = useState<MediaList>({
    items: [],
    nextOffset: undefined,
  })

  /**
   * current offset is last element in offsetHistory[]
   * control offset by pushing/popping to offsetHistory
   */
  const [offsetHistory, setOffsetHistory] = useState<MediaListOffset[]>([])
  const offset = offsetHistory[offsetHistory.length - 1]
  const resetOffset = () => setOffsetHistory([])
  const navigateNext = () => {
    if (!list.nextOffset) return
    setOffsetHistory([...offsetHistory, list.nextOffset])
  }
  const navigatePrev = () => {
    const offsets = offsetHistory.slice(0, offsetHistory.length - 1)
    setOffsetHistory(offsets)
  }
  const hasPrev = offsetHistory.length > 0
  const hasNext = !!list.nextOffset

  useEffect(() => {
    if (!cms.media.isConfigured) return
    function loadMedia() {
      setListState('loading')
      cms.media
        .list({ offset, limit: cms.media.pageSize, directory })
        .then((list) => {
          setList(list)
          setListState('loaded')
        })
        .catch((e) => {
          console.error(e)
          if (e.ERR_TYPE === 'MediaListError') {
            setListError(e)
          } else {
            setListError(defaultListError)
          }
          setListState('error')
        })
    }
    loadMedia()

    return cms.events.subscribe(
      ['media:upload:success', 'media:delete:success', 'media:pageSize'],
      loadMedia
    )
  }, [offset, directory, cms.media.isConfigured])

  const onClickMediaItem = (item: Media) => {
    if (item.type === 'dir') {
      setDirectory(path.join(item.directory, item.filename))
      resetOffset()
    }
  }

  let deleteMediaItem: (item: Media) => void
  if (allowDelete) {
    deleteMediaItem = (item: Media) => {
      if (confirm('Are you sure you want to delete this file?')) {
        cms.media.delete(item)
      }
    }
  }

  let selectMediaItem: (item: Media) => void

  if (onSelect) {
    selectMediaItem = (item: Media) => {
      onSelect(item)
      if (close) close()
    }
  }

  const [uploading, setUploading] = useState(false)
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: cms.media.accept || 'image/*',
    multiple: true,
    onDrop: async (files) => {
      try {
        setUploading(true)
        await cms.media.persist(
          files.map((file) => {
            return {
              directory: directory || '/',
              file,
            }
          })
        )
      } catch {
        // TODO: Events get dispatched already. Does anything else need to happen?
      }
      setUploading(false)
    },
  })

  const { onClick, ...rootProps } = getRootProps()

  function disableScrollBody() {
    const body = document?.body
    body.style.overflow = 'hidden'

    return () => {
      body.style.overflow = 'auto'
    }
  }

  useEffect(disableScrollBody, [])

  if (listState === 'loading' || uploading) {
    return <LoadingMediaList />
  }

  if (listState === 'not-configured') {
    return (
      <DocsLink
        title="No Media Store Configured"
        message="To use the media manager, you need to configure a Media Store."
        docsLink="https://tina.io/docs/media-cloudinary/"
      />
    )
  }

  if (listState === 'error') {
    const { title, message, docsLink } = listError
    return <DocsLink title={title} message={message} docsLink={docsLink} />
  }

  return (
    <MediaPickerWrap>
      <div className="flex items-center bg-white border-b border-gray-100 py-3 px-5 shadow-sm flex-shrink-0">
        <Breadcrumb directory={directory} setDirectory={setDirectory} />
        <UploadButton onClick={onClick} uploading={uploading} />
      </div>
      <ul
        {...rootProps}
        className={`flex flex-1 flex-col gap-4 p-5 m-0 h-full overflow-y-auto ${
          isDragActive ? `border-2 border-blue-500 rounded-lg` : ``
        }`}
      >
        <input {...getInputProps()} />

        {listState === 'loaded' && list.items.length === 0 && (
          <EmptyMediaList />
        )}

        {list.items.map((item: Media) => (
          <MediaItem
            key={item.id}
            item={item}
            onClick={onClickMediaItem}
            onSelect={selectMediaItem}
            onDelete={deleteMediaItem}
          />
        ))}
      </ul>
      <CursorPaginator
        currentOffset={offset}
        hasNext={hasNext}
        navigateNext={navigateNext}
        hasPrev={hasPrev}
        navigatePrev={navigatePrev}
      />
    </MediaPickerWrap>
  )
}

const UploadButton = ({ onClick, uploading }: any) => {
  return (
    <Button
      variant="primary"
      size="custom"
      className="text-sm h-10 px-6"
      busy={uploading}
      onClick={onClick}
    >
      {uploading ? (
        <LoadingDots />
      ) : (
        <>
          Upload <BiCloudUpload className="w-6 h-full ml-2 opacity-70" />
        </>
      )}
    </Button>
  )
}

const LoadingMediaList = (props) => {
  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center"
      {...props}
    >
      <LoadingDots color={'var(--tina-color-primary)'} />
    </div>
  )
}

const MediaPickerWrap = ({ children }) => {
  return (
    <div className="h-full flex-1 text-gray-700 flex flex-col relative bg-gray-50 outline-none active:outline-none focus:outline-none">
      {children}
    </div>
  )
}

const EmptyMediaList = (props) => {
  return (
    <div className={`text-2xl opacity-50 p-12 text-center`} {...props}>
      Drag and Drop assets here
    </div>
  )
}

const DocsLink = ({ title, message, docsLink, ...props }) => {
  return (
    <div className="h-3/4 text-center flex flex-col justify-center" {...props}>
      <h2 className="mb-3 text-xl text-gray-600">{title}</h2>
      <div className="mb-3 text-base text-gray-700">{message}</div>
      <a
        href={docsLink}
        target="_blank"
        rel="noreferrer noopener"
        className="font-bold text-blue-500 hover:text-blue-600 hover:underline transition-all ease-out duration-150"
      >
        Learn More
      </a>
    </div>
  )
}
