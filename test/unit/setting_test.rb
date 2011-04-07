# == Schema Info
#
# Table name: settings
#
#  id                :integer         not null, primary key
#  title             :string(255)
#  tagline           :string(255)
#  announcement      :text
#  footer            :text
#  theme             :string(255)
#  favicon           :string(255)
#  time_zone         :string(255)
#  private           :boolean
#  login_message     :string(255)
#  admin_only_create :string(255)     not null, default("")
#  clickable_header  :boolean

require 'test_helper'

class SettingTest < ActiveSupport::TestCase
  fixtures :all
  
  test "current_theme is selected theme" do
    assert_nil Setting.current_theme
    r = Theme.make
    r.select
    assert_equal r, Setting.current_theme
    r.deselect
    assert_nil Setting.current_theme
  end
  
  def test_to_s
    o = Setting.find(1)
    assert_equal o.to_s, 'El Dorado'
  end
  
end
