// @flow
import * as React from 'react';
import { Select, Spin, Button } from 'antd';
import debounce from 'lodash.debounce';
const Option = Select.Option;

type Props = {
  placeholder?: string,
  location?: any,
  bounds?: any,
  offset?: number,
  radius?: number,
  types?: Array<string>,
  defaultValue?: Array<ResultObj>,
  minLength: number,
  multiple: boolean,
  onChange: (Array<ResultObj> => void)
}

type State = {
  fetching: boolean,
  value: Array<ResultObj>,
  data: Array<ResultObj>,
  disabled: boolean
}

type Options = Array<{
  key: string,
  label: string
}>

type ResultObj = {
  placeId: string,
  address: string,
  gmaps?: any,
  lat?: number,
  lng?: number
}

export default class AntdGeosuggest extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.fetchLocation = debounce(this.fetchLocation, 800);

    // $FlowFixMe
    this.autocompleteService = new google.maps.places.AutocompleteService();
    // $FlowFixMe
    this.geocoder = new google.maps.Geocoder();
  }

  autocompleteService: google;
  geocoder: google;
  selection: ?Select;

  state = {
    data: [],
    value: [],
    fetching: false,
    disabled: false
  }

  static defaultProps = {
    placeholder: "Type and search for places",
    minLength: 3,
    multiple: false
  }

  componentDidMount() {
    const {defaultValue} = this.props;

    if (defaultValue && defaultValue.length > 0) {
      this.setState({value: defaultValue})
    }
  }

  componentDidUpdate() {
    const {multiple} = this.props;
    const {value, disabled} = this.state;

    if (!disabled && !multiple && value.length >= 1 && this.selection) {
      this.selection.blur()
      this.setState({disabled: false})
    }
  }

  fetchLocation = (value: string) => {
    const isShorterThanMinLength = value.length < this.props.minLength;

    if (isShorterThanMinLength || value.length === 0) {
      return;
    }

    let options = {
      input: value
    }

    const mapOptions = ['location', 'radius', 'bounds', 'types'];
    mapOptions.forEach(option => {
      if (this.props[option]) {
        // $FlowFixMe
        options[option] = this.props[option];
      }
    });

    this.setState({data: [], fetching: true}, () => {
      // Get suggested locations from google map.
      this.autocompleteService.getPlacePredictions(
        options,
        suggestsGoogle => {
          const suggestions = suggestsGoogle || [];
          const data = suggestions.map(datum => {
            return {
              address: datum.description,
              placeId: datum.place_id
            }
          })

          this.setState({data, fetching: false});
        }
      );
    });
  }
  
  handleChange = (value: Options) => {
    const that = this;
    // Geocode the location using Google geocode API. In order to get location's latitude and longtitude.
    function promiseGeocode(singleSite) {
      return new Promise((resolve) => {

        that.geocoder.geocode(
          {placeId: singleSite.placeId},
          (results, status) => {
            // $FlowFixMe
            const newData: ResultObj = singleSite;
            // $FlowFixMe
            if (status === google.maps.GeocoderStatus.OK) {
              const gmaps = results[0],
                location = gmaps.geometry.location;
    
              newData.gmaps = gmaps;
              newData.lat = location.lat();
              newData.lng = location.lng();
            }
            resolve(newData);
          }
        );
      })
    }

    // Wait for all locations to finish geocoding, and call onChange function in the end.
    Promise.all(value.map(site => promiseGeocode({placeId: site.key, address: site.label}))).then(result => {
      that.props.onChange(result);
    })
    
    this.setState({
      value: ((value: any): Array<ResultObj>),
      data: [],
      fetching: false,
    });
  }

  clearValue = () => {
    // reset value
    this.setState({
      data: [],
      value: [],
      fetching: false,
      disabled: false
    }, this.props.onChange([]))
  }

  render() {
    const { fetching, data, value, disabled } = this.state;
    const { placeholder } = this.props;
    return (
      <div>
        <Select
          ref={node => this.selection = node}
          mode="multiple"
          labelInValue
          value={value.map((v, i) => ({key: v.address || i, label: v.address, ...v}))}
          disabled={disabled}
          placeholder={placeholder}
          notFoundContent={!disabled && (fetching ? <Spin size="small" /> : "No result")}
          filterOption={false}
          onSearch={this.fetchLocation}
          onChange={this.handleChange}
          style={{width: "80%", marginRight: '10px'}}
        >
          {data.map(d => <Option key={d.placeId}>{d.address}</Option>)}
        </Select>
      </div>
    );
  }
}
