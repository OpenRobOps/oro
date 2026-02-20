/**
 * Context for providing user feedback to actions.
 *
 * TODO(herchu) Consider moving to a diferent pattern that encapsulates the context logic/internals.
 */
import React from 'react';

// Global showFeedback context
// Allows showing/hiding the feedback snackbar
const OnFeedbackContext = React.createContext(null);
OnFeedbackContext.displayName = 'onFeedback';

export default OnFeedbackContext;
