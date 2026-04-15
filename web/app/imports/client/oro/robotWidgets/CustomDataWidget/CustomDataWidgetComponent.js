/**
 * Copyright 2026 InOrbit, Inc.
 *
 *    Licensed under the Apache License, Version 2.0 (the "License");
 *    you may not use this file except in compliance with the License.
 *    You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *    Unless required by applicable law or agreed to in writing, software
 *    distributed under the License is distributed on an "AS IS" BASIS,
 *    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *    See the License for the specific language governing permissions and
 *    limitations under the License.
 */

/**
 * Custom Data widget
 * allows displaying custom key value pairs reported by the agent
 * Used by:
 *  - Custom Image widget
 *  - Log files widget
 *  - Key-value Sources widget
 */

import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Typography } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { SOURCES } from '../../../../shared/attributes';
import ImageComponent from './DataType/ImageComponent';
import KeyValueComponent from './DataType/KeyValueComponent';
import TextComponent from './DataType/TextComponent';

// Maximum age [milliseconds] a custom data can have before it can be considered stale
const MAX_DATA_AGE = 1000 * 60 * 5;
const DATA_TYPE_KV = 'key_value';

const useStyles = makeStyles()(() => ({
  textArea: {
    fontSize: '0.8125rem',
    overflowWrap: 'break-word',
    whiteSpace: 'pre-wrap',
    height: '100%',
  },
}));

const CustomDataWidgetComponent = ({
  customData,
  dataType,
  config = {},
  staleIndicator = true,
  label = '',
  maximized = false,
  variant = 'GCWidget',
  nowTs
}) => {
  const { classes } = useStyles();
  // Used both as current timestamp for stale checks and to trigger re-renders in children
  const [now, setNow] = useState(nowTs);

  // Re-render after MAX_DATA_AGE to update stale indicators in child components
  useEffect(() => {
    const timer = setTimeout(() => setNow(nowTs), MAX_DATA_AGE);
    return () => clearTimeout(timer);
  }, [nowTs]);

  if (dataType === DATA_TYPE_KV) {
    return (
      <KeyValueComponent
        customData={customData}
        staleIndicator={staleIndicator}
        now={now}
      />
    );
  }

  if (dataType === SOURCES.FILE_TEXT.value) {
    return <TextComponent customData={customData} config={config} />;
  }

  if (dataType === SOURCES.FILE_IMAGE.value) {
    return (
      <ImageComponent
        customData={customData}
        label={label}
        maximized={maximized}
        staleIndicator={staleIndicator}
        now={now}
        variant={variant}
      />
    );
  }

  return (
    <Typography className={classes.textArea}>
      {`The provided format is unsupported: ${dataType}`}
    </Typography>
  );
};

CustomDataWidgetComponent.propTypes = {
  customData: PropTypes.oneOfType([PropTypes.array, PropTypes.object]),
  dataType: PropTypes.string,
  config: PropTypes.shape({
    readOrder: PropTypes.string,
    nowrap: PropTypes.bool,
  }),
  staleIndicator: PropTypes.bool,
  label: PropTypes.string,
  maximized: PropTypes.bool,
  variant: PropTypes.oneOf(['GCWidget', 'MOWidget']),
  nowTs: PropTypes.number,
};

export default CustomDataWidgetComponent;

export { DATA_TYPE_KV };
