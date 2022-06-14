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

import React, { useState } from 'react'
import type { TinaClient } from './client'
import { TinaCloudMediaStoreClass, TinaCloudProvider } from './auth'
import { useGraphqlForms } from './hooks/use-graphql-forms'

import { FaunaClient, LocalClient } from './internalClient/index'
import type { TinaCMS } from '@tinacms/toolkit'
import type { TinaCloudSchema } from '@tinacms/schema-tools'
import { TinaDataContext } from '@tinacms/sharedctx'
import type { TinaIOConfig } from './internalClient/index'
import UrlPattern from 'url-pattern'
import type { formifyCallback } from './hooks/use-graphql-forms'
// @ts-ignore importing css is not recognized
import styles from './styles.css'
import { useCMS } from '@tinacms/toolkit'
import { useDocumentCreatorPlugin } from './hooks/use-content-creator'
import { useTina } from './edit-state'
import { parseURL } from './utils/parseUrl'

const errorButtonStyles = {
  background: '#eb6337',
  padding: '12px 18px',
  cursor: 'pointer',
  borderRadius: '50px',
  textTransform: 'uppercase',
  letterSpacing: '2px',
  fontWeight: 'bold',
  border: 'none',
  color: 'white',
  margin: '1rem 0',
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)

    this.state = {
      hasError: props.hasError,
      message: '',
      pageRefresh: false,
    }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: error.message }
  }

  /**
   * Ideally we can track the last valid state and provide a button to go back, which
   * would just reset the form to that state. This isn't ideal for many cases though,
   * in general you'd probably want to push through the invalid state until you arrive at
   * a new state which you are happy with. So we should offer the opportunity to try rendering
   * again in the new, hopefully valid, state.
   */
  render() {
    const branchData =
      window.localStorage &&
      window.localStorage.getItem('tinacms-current-branch')
    const hasBranchData = branchData && branchData.length > 0
    // @ts-ignore
    if (this.state.hasError && !this.state.pageRefresh) {
      return (
        <div
          style={{
            background: '#efefef',
            height: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <style>
            {
              '\
            body {\
              margin: 0;\
            }\
          '
            }
          </style>
          <div
            style={{
              background: '#fff',
              maxWidth: '400px',
              padding: '20px',
              fontFamily: "'Inter', sans-serif",
              borderRadius: '5px',
              boxShadow:
                '0 6px 24px rgb(0 37 91 / 5%), 0 2px 4px rgb(0 37 91 / 3%)',
            }}
          >
            <h3 style={{ color: '#eb6337' }}>TinaCMS Render Error</h3>
            <p>Tina caught an error while updating the page:</p>
            <pre style={{ marginTop: '1rem', overflowX: 'auto' }}>
              {/* @ts-ignore */}
              {this.state.message}
            </pre>
            <br />
            <p>
              If you've just updated the form, undo your most recent changes and
              click "refresh". If after a few refreshes, you're still
              encountering this error. There is a bigger issue with the site.
              Please reach out to your site admin.
            </p>
            <p>
              See our{' '}
              <a
                className="text-gray-600"
                style={{ textDecoration: 'underline' }}
                href="https://tina.io/docs/errors/faq/"
                target="_blank"
              >
                {' '}
                Error FAQ{' '}
              </a>{' '}
              for more information.
            </p>
            <button
              style={errorButtonStyles as any}
              onClick={() => {
                /* @ts-ignore */
                this.setState({ pageRefresh: true })
                setTimeout(
                  () => this.setState({ hasError: false, pageRefresh: false }),
                  3000
                )
              }}
            >
              Refresh
            </button>
            {hasBranchData && (
              <>
                <p>
                  If you're using the branch switcher, you may currently be on a
                  "stale" branch that has been deleted or whose content is not
                  compatible with the latest version of the site's layout. Click
                  the button below to switch back to the default branch for this
                  deployment.
                </p>
                <p>
                  See our{' '}
                  <a
                    className="text-gray-600"
                    style={{ textDecoration: 'underline' }}
                    href="https://tina.io/docs/errors/faq/"
                    target="_blank"
                  >
                    {' '}
                    Error FAQ{' '}
                  </a>{' '}
                  for more information.
                </p>
                <button
                  style={errorButtonStyles as any}
                  onClick={() => {
                    window.localStorage.removeItem('tinacms-current-branch')
                    window.location.reload()
                  }}
                >
                  Switch to default branch
                </button>
              </>
            )}
          </div>
        </div>
      )
    }
    /* @ts-ignore */
    if (this.state.pageRefresh) {
      return <Loader>Let's try that again.</Loader>
    }

    return this.props.children
  }
}

type APIProviderProps =
  | {
      /**
       * The API url From this client will be used to make requests.
       *
       */
      client?: never
      /**
       * Content API URL
       *
       */
      apiURL: string
      /**
       * Point to the local version of GraphQL instead of tina.io
       * https://tina.io/docs/tinacms-context/#adding-tina-to-the-sites-frontend
       *
       * @deprecated use apiURL instead
       */
      isLocalClient?: never
      /**
       * The base branch to pull content from. Note that this is ignored for local development
       *
       * @deprecated use apiURL instead
       */
      branch?: never
      /**
       * Your clientID from tina.aio
       *
       * @deprecated use apiURL instead
       */
      clientId?: never
    }
  | {
      /**
       * The API url From this client will be used to make requests.
       *
       */
      client: TinaClient<unknown>
      /**
       * Content API URL
       *
       */
      apiURL?: never
      /**
       * Point to the local version of GraphQL instead of tina.io
       * https://tina.io/docs/tinacms-context/#adding-tina-to-the-sites-frontend
       *
       * @deprecated use apiURL instead
       */
      isLocalClient?: never
      /**
       * The base branch to pull content from. Note that this is ignored for local development
       *
       * @deprecated use apiURL instead
       */
      branch?: never
      /**
       * Your clientID from tina.aio
       *
       * @deprecated use apiURL instead
       */
      clientId?: never
    }
  | {
      /**
       * Content API URL
       *
       */
      apiURL?: never
      /**
       * Point to the local version of GraphQL instead of tina.io
       * https://tina.io/docs/tinacms-context/#adding-tina-to-the-sites-frontend
       *
       * @deprecated use apiURL instead
       */
      isLocalClient?: boolean
      /**
       * The base branch to pull content from. Note that this is ignored for local development
       *
       * @deprecated use apiURL instead
       */
      branch?: string
      /**
       * Your clientID from tina.aio
       *
       * @deprecated use apiURL instead
       */
      clientId?: string
      /**
       * The API url From this client will be used to make requests.
       *
       */
      client: never
      isFaunaClient?: boolean
      faunaContentUrl?: string
    }

interface BaseProviderProps {
  /** Callback if you need access to the TinaCMS instance */
  cmsCallback?: (cms: TinaCMS) => TinaCMS
  /** Callback if you need access to the "formify" API */
  formifyCallback?: formifyCallback
  /** Callback if you need access to the "document creator" API */
  documentCreatorCallback?: Parameters<typeof useDocumentCreatorPlugin>[0]
  /** TinaCMS media store instance */
  mediaStore?:
    | TinaCloudMediaStoreClass
    | (() => Promise<TinaCloudMediaStoreClass>)
  /** Media store/manager base path */
  mediaBasePath?: string
  tinaioConfig?: TinaIOConfig
  schema?: TinaCloudSchema<false>
}

type QueryProviderProps =
  | {
      /** Your React page component */
      children: (props?: any) => React.ReactNode
      /** The query from getStaticProps */
      query: string | undefined
      /** Any variables from getStaticProps */
      variables: object | undefined
      /** The `data` from getStaticProps */
      data: object
    }
  | {
      /** Your React page component */
      children: React.ReactNode
      /** The query from getStaticProps */
      query?: never
      /** Any variables from getStaticProps */
      variables?: never
      /** The `data` from getStaticProps */
      data?: never
    }

export type TinaCMSProviderDefaultProps = QueryProviderProps &
  APIProviderProps &
  BaseProviderProps

export const TinaCMSProvider2 = ({
  query,
  documentCreatorCallback,
  formifyCallback,
  schema,
  ...props
}: TinaCMSProviderDefaultProps) => {
  const validOldSetup =
    new Boolean(props?.isLocalClient) ||
    (new Boolean(props?.clientId) && new Boolean(props?.branch))

  const apiURL = props?.client?.apiUrl || props?.apiURL

  // branch & clientId are still supported, so don't throw if they're provided
  if (!apiURL && !validOldSetup) {
    throw new Error(
      `Must provide apiUrl or a client to the TinaWrapper component`
    )
  }

  const { branch, clientId, isLocalClient, isFaunaClient, faunaContentUrl } =
    props.apiURL
      ? parseURL(props.apiURL)
      : {
          branch: props.branch,
          clientId: props.clientId,
          isLocalClient: props.isLocalClient,
          isFaunaClient: false,
          faunaContentUrl: null,
        }

  // schema is now required as the Global Nav and CMS utilize it
  if (!schema) {
    throw new Error(
      '`schema` is required to be passed as a property to `TinaProvider`.  You can learn more about this change here: https://github.com/tinacms/tinacms/pull/2823'
    )
  }

  return (
    <>
      <TinaCloudProvider
        branch={branch}
        clientId={clientId}
        tinaioConfig={props.tinaioConfig}
        isLocalClient={isLocalClient}
        faunaContentUrl={faunaContentUrl}
        isFaunaClient={isFaunaClient}
        cmsCallback={props.cmsCallback}
        mediaStore={props.mediaStore}
        mediaBasePath={props.mediaBasePath}
        schema={schema}
      >
        <style>{styles}</style>
        <ErrorBoundary>
          <DocumentCreator documentCreatorCallback={documentCreatorCallback} />
          <TinaDataProvider formifyCallback={formifyCallback}>
            {typeof props.children == 'function' ? (
              <TinaQuery
                {...props}
                variables={props.variables}
                data={props.data}
                query={query}
                formifyCallback={formifyCallback}
                children={props.children as any}
              />
            ) : (
              props.children
            )}
          </TinaDataProvider>
        </ErrorBoundary>
      </TinaCloudProvider>
    </>
  )
}

const DocumentCreator = ({
  documentCreatorCallback,
}: {
  /** Callback if you need access to the "document creator" API */
  documentCreatorCallback?: Parameters<typeof useDocumentCreatorPlugin>[0]
}) => {
  useDocumentCreatorPlugin(documentCreatorCallback)

  return null
}

interface TinaQueryProps {
  /** The query from getStaticProps */
  query: string
  /** Any variables from getStaticProps */
  variables: object
  /** The `data` from getStaticProps */
  data: object
  /** Your React page component */
  children: (props: { data: object }) => React.ReactNode
  /** Callback if you need access to the "formify" API */
  formifyCallback?: formifyCallback
  /** Callback if you need access to the "document creator" API */
}

//Legacy'ish Container that auto-registers forms/document creator
const TinaQuery = (props: TinaQueryProps) => {
  return <TinaQueryInner key={`rootQuery-${props.query}`} {...props} />
}

const TinaQueryInner = ({ children, ...props }: TinaQueryProps) => {
  const { data: liveData, isLoading } = useTina({
    query: props.query,
    variables: props.variables,
    data: props.data,
  })

  return (
    <>
      {children(
        isLoading || !props.query ? props : { ...props, data: liveData }
      )}
    </>
  )
}

// TinaDataProvider can only manage one "request" object at a timee
export const TinaDataProvider = ({
  children,
  formifyCallback,
}: {
  children: any
  formifyCallback: formifyCallback
}) => {
  const [request, setRequest] = useState<{ query: string; variables: object }>()
  const [state, setState] = React.useState({
    payload: undefined,
    isLoading: true,
  })

  return (
    <TinaDataContext.Provider
      value={{
        setRequest,
        isLoading: state.isLoading,
        state: { payload: state.payload },
      }}
    >
      <FormRegistrar
        key={request?.query} // unload on page/query change
        request={request}
        formifyCallback={formifyCallback}
        onPayloadStateChange={setState}
      />
      {children}
    </TinaDataContext.Provider>
  )
}

const FormRegistrar = ({
  request,
  formifyCallback,
  onPayloadStateChange,
}: {
  request: { query: string; variables: object }
  formifyCallback: formifyCallback
  onPayloadStateChange: ({ payload: object, isLoading: boolean }) => void
}) => {
  const cms = useCMS()

  const [payload, isLoading] = useGraphqlForms({
    query: request?.query,
    variables: request?.variables,
    formify: (args) => {
      if (formifyCallback) {
        return formifyCallback(args, cms)
      } else {
        return args.createForm(args.formConfig)
      }
    },
  })

  React.useEffect(() => {
    onPayloadStateChange({ payload, isLoading })
  }, [JSON.stringify(payload), isLoading])

  return isLoading ? (
    <Loader>
      <></>
    </Loader>
  ) : null
}

const Loader = (props: { children: React.ReactNode }) => {
  return (
    <>
      <div
        style={{
          position: 'fixed',
          background: 'rgba(0, 0, 0, 0.5)',
          inset: 0,
          zIndex: 200,
          opacity: '0.8',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px',
        }}
      >
        <div
          style={{
            background: '#f6f6f9',
            boxShadow:
              '0px 2px 3px rgba(0, 0, 0, 0.05), 0 4px 12px rgba(0, 0, 0, 0.1)',
            borderRadius: '5px',
            padding: '40px 32px',
            width: '460px',
            maxWidth: '90%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
          }}
        >
          <svg
            style={{
              width: '64px',
              color: '#2296fe',
              marginTop: '-8px',
              marginBottom: '16px',
            }}
            version="1.1"
            id="L5"
            xmlns="http://www.w3.org/2000/svg"
            xmlnsXlink="http://www.w3.org/1999/xlink"
            x="0px"
            y="0px"
            viewBox="0 0 100 64"
            enableBackground="new 0 0 0 0"
            xmlSpace="preserve"
          >
            <circle fill="currentColor" stroke="none" cx={6} cy={32} r={6}>
              <animateTransform
                attributeName="transform"
                dur="1s"
                type="translate"
                values="0 15 ; 0 -15; 0 15"
                calcMode="spline"
                keySplines="0.8 0 0.4 1; 0.4 0 0.2 1"
                repeatCount="indefinite"
                begin="0.1"
              />
            </circle>
            <circle fill="currentColor" stroke="none" cx={30} cy={32} r={6}>
              <animateTransform
                attributeName="transform"
                dur="1s"
                type="translate"
                values="0 15 ; 0 -10; 0 15"
                calcMode="spline"
                keySplines="0.8 0 0.4 1; 0.4 0 0.2 1"
                repeatCount="indefinite"
                begin="0.2"
              />
            </circle>
            <circle fill="currentColor" stroke="none" cx={54} cy={32} r={6}>
              <animateTransform
                attributeName="transform"
                dur="1s"
                type="translate"
                values="0 15 ; 0 -5; 0 15"
                calcMode="spline"
                keySplines="0.8 0 0.4 1; 0.4 0 0.2 1"
                repeatCount="indefinite"
                begin="0.3"
              />
            </circle>
          </svg>
          <p
            style={{
              fontSize: '18px',
              color: '#252336',
              textAlign: 'center',
              lineHeight: '1.3',
              fontFamily: "'Inter', sans-serif",
              fontWeight: 'normal',
            }}
          >
            Please wait, Tina is loading data...
          </p>
        </div>
      </div>
      {props.children}
    </>
  )
}

/**
 * @deprecated v0.62.0: Use `staticRequest` and a "try catch" block instead. see https://tina.io/docs/features/data-fetching/#querying-tina-content-in-nextjs for more details
 *
 * A convenience function which makes a GraphQL request
 * to a local GraphQL server and ensures the response fits
 * the shape expected by Tina context in your application
 */
export const getStaticPropsForTina = async ({
  query,
  variables,
}: {
  query: string
  variables?: object
}) => {
  try {
    const data = await staticRequest({ query, variables })
    return JSON.parse(
      JSON.stringify({
        data,
        query,
        variables,
      })
    )
  } catch (e) {
    // FIXME: no need to catch all errors, just the ones that are related to
    // a new document being created, if there's a way to surface those only
    // we can still throw when real errors occur
    return JSON.parse(
      JSON.stringify({
        data: {},
        query,
        variables,
      })
    )
  }
}

function is_server() {
  return !(typeof window != 'undefined' && window.document)
}

/**
 * A convenience function which makes a GraphQL request
 * to a remote GraphQL server.
 */
export const faunaRequest = async ({
  query,
  variables,
  faunaUrl,
}: {
  /** A GraphQL request string */
  query: string
  /** GraphQL variables */
  variables?: object
  /** Our graphql server hooked up to FaunaDB */
  faunaUrl: string
}) => {
  const client = new FaunaClient({ customContentApiUrl: faunaUrl })
  if (!is_server()) {
    // If we are running this in the browser (for example a useEffect) we should display a warning
    console.warn(`Whoops! Looks like you are using \`staticRequest\` in the browser to fetch data.

The local server is not available outside of \`getStaticProps\` or \`getStaticPaths\` functions.
This function should only be called on the server at build time.

This will work when developing locally but NOT when deployed to production.
`)
  }

  return client.request(query, { variables })
}

/**
 * A convenience function which makes a GraphQL request
 * to a local GraphQL server. Only recommended for functions
 * which run at build-time like `getStaticProps` or `getStaticPaths`
 */
export const staticRequest = async ({
  query,
  variables,
}: {
  /** A GraphQL request string */
  query: string
  /** GraphQL variables */
  variables?: object
}) => {
  const client = new LocalClient()
  if (!is_server()) {
    // If we are running this in the browser (for example a useEffect) we should display a warning
    console.warn(`Whoops! Looks like you are using \`staticRequest\` in the browser to fetch data.

The local server is not available outside of \`getStaticProps\` or \`getStaticPaths\` functions.
This function should only be called on the server at build time.

This will work when developing locally but NOT when deployed to production.
`)
  }

  return client.request(query, { variables })
}
/**
 * A passthru function which allows editors
 * to know the temlpate string is a GraphQL
 * query or muation
 */
export function gql(strings: TemplateStringsArray, ...args: string[]): string {
  let str = ''
  strings.forEach((string, i) => {
    str += string + (args[i] || '')
  })
  return str
}
