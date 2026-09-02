import type { App, Plugin } from 'vue';

import Alert from 'ant-design-vue/es/alert';
import AutoComplete from 'ant-design-vue/es/auto-complete';
import Button from 'ant-design-vue/es/button';
import Card from 'ant-design-vue/es/card';
import Checkbox from 'ant-design-vue/es/checkbox';
import Col from 'ant-design-vue/es/col';
import Collapse from 'ant-design-vue/es/collapse';
import DatePicker from 'ant-design-vue/es/date-picker';
import Descriptions from 'ant-design-vue/es/descriptions';
import Divider from 'ant-design-vue/es/divider';
import Drawer from 'ant-design-vue/es/drawer';
import Empty from 'ant-design-vue/es/empty';
import Form from 'ant-design-vue/es/form';
import Input from 'ant-design-vue/es/input';
import InputNumber from 'ant-design-vue/es/input-number';
import List from 'ant-design-vue/es/list';
import Modal from 'ant-design-vue/es/modal';
import Progress from 'ant-design-vue/es/progress';
import Radio from 'ant-design-vue/es/radio';
import Result from 'ant-design-vue/es/result';
import Row from 'ant-design-vue/es/row';
import Segmented from 'ant-design-vue/es/segmented';
import Select from 'ant-design-vue/es/select';
import Space from 'ant-design-vue/es/space';
import Spin from 'ant-design-vue/es/spin';
import Statistic from 'ant-design-vue/es/statistic';
import Switch from 'ant-design-vue/es/switch';
import Table from 'ant-design-vue/es/table';
import Tabs from 'ant-design-vue/es/tabs';
import Tag from 'ant-design-vue/es/tag';
import Timeline from 'ant-design-vue/es/timeline';

const businessComponents: Plugin[] = [
  Alert,
  AutoComplete,
  Button,
  Card,
  Checkbox,
  Col,
  Collapse,
  DatePicker,
  Descriptions,
  Divider,
  Drawer,
  Empty,
  Form,
  Input,
  InputNumber,
  List,
  Modal,
  Progress,
  Radio,
  Result,
  Row,
  Segmented,
  Select,
  Space,
  Spin,
  Statistic,
  Switch,
  Table,
  Tabs,
  Tag,
  Timeline,
];

export function registerAntdBusinessComponents(app: App) {
  for (const component of businessComponents) app.use(component);
}
