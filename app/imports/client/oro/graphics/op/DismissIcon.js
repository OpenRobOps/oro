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

// This icon is used in Notification banner
import React from 'react';
import SvgIcon from '@mui/material/SvgIcon';
import theme from '../../../Styles';

const DismissIcon = () => {
  return (
    <SvgIcon width="17" height="16" viewBox="0 0 17 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="8.46094" cy="8" r="8" fill={theme.palette.icons.neutral} />
      <path d="M5.5094 8.04297L4.46094 9.07812L7.41878 11.9984L8.46724 10.9633L5.5094 8.04297Z" fill="white" />
      <path d="M6.36951 10.9648L7.41797 12L13.4595 6.03515L12.4111 5L6.36951 10.9648Z" fill="white" />
    </SvgIcon>
  );
};

export default DismissIcon;
