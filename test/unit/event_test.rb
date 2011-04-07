# == Schema Info
#
# Table name: events
#
#  id          :integer         not null, primary key
#  title       :string(255)
#  description :text
#  date        :datetime
#  reminder    :boolean
#  user_id     :integer
#  created_at  :datetime
#  updated_at  :datetime

require 'test_helper'

class EventTest < ActiveSupport::TestCase
  fixtures :all
  
  def test_to_s
    e = Event.find(1)
    assert_equal e.to_s, 'MyString'
  end
  
end
