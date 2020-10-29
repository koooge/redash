import React, { useEffect, useState } from "react";
// @ts-expect-error (Must be removed after adding @redash/viz typing)
import ErrorBoundary, { ErrorBoundaryContext } from "@redash/viz/lib/components/ErrorBoundary";
import { Auth } from "@/services/auth";
import { policy } from "@/services/policy";
import { CurrentRoute } from "@/services/routes";
import organizationStatus from "@/services/organizationStatus";
import DynamicComponent from "@/components/DynamicComponent";
import ApplicationLayout from "./ApplicationLayout";
import ErrorMessage from "./ErrorMessage";

export type UserSessionWrapperRenderChildrenProps<P> = {
  pageTitle?: string;
  onError: (error: Error) => void;
} & P;

export interface UserSessionWrapperProps<P> {
  render: (props: UserSessionWrapperRenderChildrenProps<P>) => React.ReactNode;
  currentRoute: CurrentRoute<P>;
  bodyClass?: string;
}

// This wrapper modifies `route.render` function and instead of passing `currentRoute` passes an object
// that contains:
// - `currentRoute.routeParams`
// - `pageTitle` field which is equal to `currentRoute.title`
// - `onError` field which is a `handleError` method of nearest error boundary

export function UserSessionWrapper<P>({ bodyClass, currentRoute, render }: UserSessionWrapperProps<P>) {
  const [isAuthenticated, setIsAuthenticated] = useState(!!Auth.isAuthenticated());
  useEffect(() => {
    let isCancelled = false;
    Promise.all([Auth.requireSession(), organizationStatus.refresh(), policy.refresh()])
      .then(() => {
        if (!isCancelled) {
          setIsAuthenticated(!!Auth.isAuthenticated());
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setIsAuthenticated(false);
        }
      });
    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    if (bodyClass) {
      document.body.classList.toggle(bodyClass, true);
      return () => {
        document.body.classList.toggle(bodyClass, false);
      };
    }
    return;
  }, [bodyClass]);

  if (!isAuthenticated) {
    return null;
  }

  return (
    <ApplicationLayout>
      <React.Fragment key={currentRoute.key}>
        <ErrorBoundary renderError={(error: Error) => <ErrorMessage error={error} />}>
          <ErrorBoundaryContext.Consumer>
            {({ handleError }: { handleError: UserSessionWrapperRenderChildrenProps<P>["onError"] }) =>
              render({ ...currentRoute.routeParams, pageTitle: currentRoute.title, onError: handleError })
            }
          </ErrorBoundaryContext.Consumer>
        </ErrorBoundary>
      </React.Fragment>
    </ApplicationLayout>
  );
}

export type RouteWithUserSessionOptions<P> = {
  render: (props: UserSessionWrapperRenderChildrenProps<P>) => React.ReactNode;
  bodyClass?: string;
  title: string;
  path: string;
};

export const UserSessionWrapperDynamicComponentName = "UserSessionWrapper";

export default function routeWithUserSession<P extends Record<string, unknown> = Record<string, unknown>>({
  render: originalRender,
  bodyClass,
  ...rest
}: RouteWithUserSessionOptions<P>) {
  return {
    ...rest,
    render: (currentRoute: CurrentRoute<P>) => {
      const props = {
        render: originalRender,
        bodyClass,
        currentRoute,
      };
      return (
        <DynamicComponent
          {...props}
          name={UserSessionWrapperDynamicComponentName}
          fallback={<UserSessionWrapper {...props} />}
        />
      );
    },
  };
}
