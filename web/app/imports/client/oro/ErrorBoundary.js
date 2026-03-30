/**
 * Error Boundary component
 * Component to catch crashes in rendering.
 * Keep this component as simple, and with as little dependencies as possible.
 * Try not to import things at all.
 */
/* eslint-disable react/prop-types */
import React from 'react';

// Styles. Not importing them from our Styles class or any stylesheet library (see file comments)
const containerStyle = {
  'font-family': '"Inter","Helvetica","Arial",sans-serif',
  padding: '16px'
};
const errorStyle = {
  color: 'red',
  fontWeight: 'bold'
};

// Error variants. "page" is the default, which may render a larger error page.
// The "widget" variant is smaller and should fit within normal widget containers.
const VARIANT_PAGE = "page";
const VARIANT_WIDGET = "widget";
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      errorObj: {},
      showError: false
    };
  }

  handleShowErrorMsg = () => {
    this.setState(pS => ({ showError: !pS.showError }));
  };

  reloadPage = () => {
    window.location.reload();
  };

  static getDerivedStateFromError(errorObj) {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, errorObj };
  }

  componentDidCatch(error, errorInfo) {
    // You can also log the error to an error reporting service
    // logErrorToMyService(error, errorInfo);
    console.error('Error caught', error, errorInfo);
  }

  render() {
    const { variant = VARIANT_PAGE } = this.props;
    const { hasError, errorObj, showError } = this.state;
    if (hasError) {
      const errorMsg = (errorObj && errorObj.message) || '';
      // You can render any custom fallback UI
      // TODO (istvan) make this pretty!
      return (
        <div style={containerStyle}>
          { variant == VARIANT_WIDGET ? (
            <h2>⚠️ Something went wrong</h2>
          ): (
            <h1>⚠️ Something went wrong with the app</h1>
          )}
          <p>
            Reach out to our support team for help.
          </p>
          <p>
            If reloading does not work, clearing cookies and browser cache and try again.
          </p>
          <button type="button" onClick={this.reloadPage}>
            Reload Page
          </button>
          <button type="button" onClick={this.handleShowErrorMsg}>
            {!showError ? 'Show ' : 'Hide '}
            Error Message
          </button>
          {showError && (
            <p style={errorStyle}>
              {errorMsg}
            </p>
          )}
        </div>
      );
    }
    const { children } = this.props;
    return children;
  }
}

export default ErrorBoundary;
